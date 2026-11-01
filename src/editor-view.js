// Pattern editor view (humble): renders the grid from an EditorModel draft and reports user
// actions through callbacks. Owns the DOM of the editor panel and nothing else.
// Browser only.
const EditorView = (() => {
  /**
   * @param {{ $: Function, model: object, voiceLabel: object, onSave: () => object|null, onSaveAndPlay: Function,
   *           onDelete: Function, onExport: Function, onImport: (file: File) => Promise<void>, loadSelected: () => object }} deps
   */
  function create({ $, model, voiceLabel, onSave, onSaveAndPlay, onDelete, onExport, onImport, loadSelected }) {
    let draft = model.newDraft();
    const status = (text) => { $("edStatus").textContent = text; };

    function render() {
      $("edName").value = draft.name;
      $("edBars").value = String(draft.bars);
      const cols = draft.bars * model.STEPS_PER_BAR;
      const cls = (i) => (i % 16 === 0 ? "bar" : i % 4 === 0 ? "beat" : "");
      const t = $("edGrid");
      t.innerHTML = "";
      const head1 = document.createElement("tr");
      head1.innerHTML = "<th></th>" + Array.from({ length: draft.bars }, (_, b) => `<th colspan="16" class="ed-bar">bar ${b + 1}</th>`).join("");
      const head2 = document.createElement("tr");
      head2.innerHTML = "<th></th>" + Array.from({ length: cols }, (_, i) => `<th class="ed-count ${cls(i)}${i % 4 === 0 ? " beat" : ""}">${model.columnLabel(i)}</th>`).join("");
      t.append(head1, head2);
      for (const voice of model.ROWS) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<th class="ed-voice">${voiceLabel[voice]}</th>` + Array.from({ length: cols }, (_, i) => {
          const st = draft.cells[`${voice}@${i}`] || "";
          return `<td class="${cls(i)}"><button type="button" class="cell" data-voice="${voice}" data-step="${i}" data-state="${st}" aria-label="${voiceLabel[voice]}, bar ${Math.floor(i / 16) + 1} step ${(i % 16) + 1}${st ? ", " + st : ""}">${model.GLYPH[st] || ""}</button></td>`;
        }).join("");
        t.appendChild(tr);
      }
      const stick = document.createElement("tr");
      stick.innerHTML = `<th class="ed-voice">Sticking</th>` + Array.from({ length: cols }, (_, i) => `<td class="${cls(i)}"><input class="stick" data-step="${i}" maxlength="1" value="${draft.sticking[i] || ""}" aria-label="sticking, bar ${Math.floor(i / 16) + 1} step ${(i % 16) + 1}" /></td>`).join("");
      t.appendChild(stick);
      $("edDelete").disabled = !draft.id;
    }

    $("edGrid").addEventListener("click", (e) => {
      const b = e.target.closest("button.cell");
      if (!b) return;
      const next = model.cycleCell(draft, b.dataset.voice, Number(b.dataset.step));
      b.dataset.state = next || "";
      b.textContent = model.GLYPH[next] || "";
      status("");
    });
    $("edGrid").addEventListener("input", (e) => {
      const inp = e.target.closest("input.stick");
      if (!inp) return;
      inp.value = model.setSticking(draft, Number(inp.dataset.step), inp.value);
    });
    // Arrow keys move between cells; space and Enter cycle a cell through the button's own click.
    $("edGrid").addEventListener("keydown", (e) => {
      const b = e.target.closest("button.cell");
      if (!b || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const row = model.ROWS.indexOf(b.dataset.voice);
      const step = Number(b.dataset.step);
      const cols = draft.bars * model.STEPS_PER_BAR;
      const next = { ArrowLeft: [row, step - 1], ArrowRight: [row, step + 1], ArrowUp: [row - 1, step], ArrowDown: [row + 1, step] }[e.key];
      const [r, s] = [Math.max(0, Math.min(model.ROWS.length - 1, next[0])), Math.max(0, Math.min(cols - 1, next[1]))];
      const target = $("edGrid").querySelector(`button.cell[data-voice="${model.ROWS[r]}"][data-step="${s}"]`);
      if (target) target.focus();
    });
    $("edName").oninput = () => { draft.name = $("edName").value; };
    // Re-render only on a real change: the blur after editing the field fires `change` again with the
    // same value, and rebuilding the grid between mousedown and mouseup would swallow the next click.
    $("edBars").onchange = () => {
      const bars = Math.max(1, Math.min(8, Number($("edBars").value) || 1));
      if (bars === draft.bars) { $("edBars").value = String(bars); return; }
      draft.bars = bars;
      render();
    };
    $("edDup").onclick = () => { if (model.duplicateLastBar(draft)) { render(); status(`Bar ${draft.bars - 1} copied into bar ${draft.bars}.`); } else status("Already at eight bars."); };
    $("edClear").onclick = () => { model.clearLastBar(draft); render(); status(`Bar ${draft.bars} cleared.`); };
    $("edNew").onclick = () => { draft = model.newDraft(); render(); status("New pattern. Click cells to add notes, then Save."); };
    function loadPattern(p) {
      draft = model.fromPattern(p);
      render();
      status(draft.id ? `Editing "${p.name}".` : `Editing a copy of the built-in "${p.name}"; Save stores it under My patterns.`);
    }
    $("edLoad").onclick = () => loadPattern(loadSelected());
    $("edSave").onclick = () => onSave();
    $("edSavePlay").onclick = () => onSaveAndPlay();
    $("edDelete").onclick = () => { if (draft.id) onDelete(draft.id); };
    $("edExport").onclick = () => onExport();
    $("edImport").onclick = () => $("edFile").click();
    $("edFile").onchange = async () => {
      const file = $("edFile").files[0];
      $("edFile").value = "";
      if (file) await onImport(file);
    };

    return {
      render, status, loadPattern,
      draft: () => draft,
      /** Validate the draft into a pattern; on failure shows the reason and returns null. */
      pattern() { try { return model.toPattern(draft); } catch (err) { status("Not saved: " + err.message); return null; } },
      saved(p) { draft.id = p.id; render(); status(`Saved "${p.name}" (${p.hits.length} notes, ${p.bars} bar${p.bars === 1 ? "" : "s"}).`); },
      reset() { draft = model.newDraft(); render(); },
    };
  }
  return { create };
})();
