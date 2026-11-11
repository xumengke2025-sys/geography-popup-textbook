import { contents, figures, pdfAt, pageUrl, spreadAt, spreadPageLabel, LAST_PRINTED_PAGE, SPREADS, TITLE } from './textbook-catalog';
import './textbook-workbench.css';

const icon = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const icons = {
  book: icon('<path d="M12 5.5C8 3.5 4.5 4 3 4.5v15c3-1 6-1 9 1 3-2 6-2 9-1v-15c-3-1-6-.5-9 1Zm0 0v15M6 8l3 .5M6 11l3 .5m6-3 3-.5m-3 3.5 3-.5"/>'),
  notes: icon('<path d="M14 4H5v16h14v-9M8 9h3M8 13h3M8 17h6m0-7 6-6-2-2-6 6-1 3 3-1Z"/>'),
  settings: icon('<path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M10 15v6"/>'),
  close: icon('<path d="m6 6 12 12M6 18 18 6"/>'),
  chevron: icon('<path d="m9 5 7 7-7 7"/>'),
};
const shortChapters = ['宇宙', '大气', '水', '地貌', '植被土壤', '灾害'];
const pageName = spreadPageLabel;

interface WorkbenchState {
  spread: number; active: string | null; playing: boolean; teacher: boolean;
  twoD: boolean; reduced: boolean; busy: boolean;
}
interface WorkbenchActions {
  onNavigate: (spread: number) => unknown;
}

/** Desk furniture owns navigation presentation only. All turns, model inputs,
 * teacher isolation and persistence keep going through the book controller. */
export function createWorkbench(actions: WorkbenchActions) {
  const $ = <E extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<E>(selector)!;
  const root = $('#book-ui'), dock = $('.capsule'), directory = $('#contents');
  let state: WorkbenchState = { spread: 0, active: null, playing: false, teacher: false, twoD: false, reduced: false, busy: false };
  let preview = 0, directoryView: 'chapters' | 'models' = 'chapters', lastSpread = -1;

  root.insertAdjacentHTML('beforeend', `<header id="desk-header"><div class="desk-title">${icons.book}<h1>${TITLE}</h1></div><div class="desk-tools"><button id="desk-notes" class="desk-tool" aria-label="本页笔记">${icons.notes}<span>笔记</span></button><button id="desk-settings" class="desk-tool" aria-label="工作台设置">${icons.settings}<span>设置</span></button></div></header>
  <nav id="chapter-tabs" aria-label="章节书签">${contents.slice(0, 6).map((c, i) => `<button data-chapter="${i}" title="${c.title}" aria-label="翻到${c.title}" style="--tab-order:${i}"><span>${shortChapters[i]}</span><span class="chapter-tab-number" aria-hidden="true">${i + 1}</span></button>`).join('')}</nav>
  <section id="folio" aria-label="快速翻页" hidden><div class="folio-heading"><h2>快速翻页</h2><form id="folio-jump"><label for="folio-page">第</label><input id="folio-page" type="number" min="1" max="${LAST_PRINTED_PAGE}" inputmode="numeric" required aria-label="正文页码"><span>页</span><button type="submit">前往${icons.chevron}</button></form><button id="folio-close" class="desk-tool" aria-label="关闭快速翻页">${icons.close}</button></div><div id="folio-thumbs"></div><div class="folio-track"><span>封面</span><input id="folio-range" type="range" min="0" max="${SPREADS}" step="1" value="0" aria-label="预览跨页"><button id="folio-go">翻到这里${icons.chevron}</button></div></section>`);

  // Reuse the original source controls and callbacks, with visible action names.
  const tools = $('.desk-tools');
  for (const [id, label] of [['cRead', '原页'], ['cTeach', '授课'], ['cStill', '静态']] as const) {
    const button = $('#' + id); button.classList.add('desk-tool');
    button.insertAdjacentHTML('beforeend', `<span>${label}</span>`);
    tools.insertBefore(button, $('#desk-settings'));
  }
  root.append($('#cContents')); $('#cContents').classList.add('directory-bookmark');
  $('#cContents').insertAdjacentHTML('beforeend', '<span>目录</span>');
  $('#cContents').setAttribute('aria-controls', 'contents'); $('#cContents').setAttribute('aria-expanded', 'false');
  dock.removeAttribute('data-glass'); dock.classList.remove('glass');
  dock.querySelector('.sep')?.remove();
  for (const [id, label] of [['cPrev', '上一页'], ['cNext', '下一页'], ['cWatch', '展开']] as const) {
    $('#' + id).insertAdjacentHTML('beforeend', `<span class="control-name">${label}</span>`);
  }
  $('#cPause').insertAdjacentHTML('beforeend', '<span class="control-name">播放</span>');
  dock.insertAdjacentHTML('beforeend', '<button id="folio-toggle" aria-controls="folio" aria-expanded="false" title="快速翻页"><span id="folio-location">封面</span><span class="folio-chevron" aria-hidden="true"></span></button>');
  // Three-dimensional models remain the subject, not a second drawing in the UI.
  $('#restart').insertAdjacentHTML('afterbegin', icon('<path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/>'));
  $('#fold').insertAdjacentHTML('afterbegin', icon('<path d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"/>'));
  $('#scene-view').dataset.workbenchControl = 'view';
  $('#phase').setAttribute('aria-label', '拖动演示进度，暂停并回看');

  const scroll = directory.querySelector<HTMLElement>('.contents-scroll')!;
  const existingFigures = directory.querySelector<HTMLDetailsElement>('.figure-index')!;
  const modelList = document.createElement('div'); modelList.id = 'model-contents';
  modelList.append(...existingFigures.querySelectorAll('[data-figure]')); existingFigures.remove();
  const chapterList = document.createElement('div'); chapterList.id = 'chapter-contents';
  chapterList.append(...scroll.childNodes); scroll.append(chapterList, modelList);
  for (const [panel, tab] of [[chapterList, 'contents-chapters'], [modelList, 'contents-models']] as const) {
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab);
  }
  modelList.hidden = true;
  scroll.insertAdjacentHTML('beforeend', '<p class="directory-empty" role="status" hidden>没有找到相关章节或演示</p>');
  directory.querySelector('.panel-heading')!.insertAdjacentHTML('afterend', `<div class="directory-tabs" role="tablist" aria-label="目录类型"><button id="contents-chapters" role="tab" aria-selected="true" aria-controls="chapter-contents">教材目录</button><button id="contents-models" role="tab" aria-selected="false" aria-controls="model-contents" tabindex="-1">立体演示 <span>${figures.length}</span></button></div><label class="directory-search">${icon('<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>')}<input id="contents-search" type="search" placeholder="查找章节或演示" aria-label="查找章节或演示"></label>`);

  function filterDirectory() {
    const value = $<HTMLInputElement>('#contents-search').value.trim().toLowerCase();
    const panel = directoryView === 'chapters' ? chapterList : modelList;
    for (const button of panel.querySelectorAll<HTMLElement>('.contents-row')) {
      const chapter = button.closest('.chapter');
      button.hidden = !!value && !(button.textContent + (chapter?.querySelector('.chapter-title')?.textContent ?? '')).toLowerCase().includes(value);
    }
    for (const chapter of chapterList.querySelectorAll<HTMLElement>('.chapter'))
      chapter.hidden = !!value && ![...chapter.querySelectorAll<HTMLElement>('.contents-row')].some(row => !row.hidden);
    $('.directory-empty').hidden = [...panel.querySelectorAll<HTMLElement>('.contents-row')].some(row => !row.hidden);
  }
  function setDirectoryView(view: typeof directoryView) {
    directoryView = view; chapterList.hidden = view !== 'chapters'; modelList.hidden = view !== 'models';
    for (const [id, selected] of [['contents-chapters', view === 'chapters'], ['contents-models', view === 'models']] as const) {
      $('#' + id).setAttribute('aria-selected', String(selected)); $('#' + id).tabIndex = selected ? 0 : -1;
    }
    filterDirectory();
  }
  $('#contents-chapters').onclick = () => setDirectoryView('chapters');
  $('#contents-models').onclick = () => setDirectoryView('models');
  $('.directory-tabs').addEventListener('keydown', event => {
    const e = event as KeyboardEvent;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    setDirectoryView(e.key === 'Home' ? 'chapters' : e.key === 'End' ? 'models' : directoryView === 'chapters' ? 'models' : 'chapters');
    $(directoryView === 'chapters' ? '#contents-chapters' : '#contents-models').focus();
  });
  $('#contents-search').oninput = filterDirectory;
  $('#desk-notes').onclick = () => $('#notes-button').click();
  $('#desk-settings').onclick = () => $('#settings-button').click();
  $('#chapter-tabs').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.onclick = () => {
    closeFolio(); actions.onNavigate(spreadAt(contents[Number(button.dataset.chapter)].page + 5));
  });

  function renderFolio() {
    $('#folio-location').textContent = pageName(state.spread);
    $<HTMLInputElement>('#folio-range').value = String(preview);
    const start = Math.max(0, Math.min(SPREADS - 4, preview - 2));
    $('#folio-thumbs').innerHTML = Array.from({ length: 5 }, (_, i) => start + i).map(k => {
      const pdfs = (['left', 'right'] as const).map(side => pdfAt(k, side)).filter((pdf): pdf is number => pdf !== null);
      const images = k === 0 ? `<div class="folio-cover">${icons.book}<span>地理</span></div>` : pdfs.map(pdf => `<img src="${pageUrl(pdf, true)}" alt="" draggable="false">`).join('');
      return `<button class="folio-thumb" data-folio-spread="${k}" aria-label="翻到${pageName(k)}"${k === state.spread ? ' aria-current="page"' : ''}${k === preview ? ' data-preview="true"' : ''}><span class="folio-mini-spread">${images}</span><span>${pageName(k)}</span></button>`;
    }).join('');
    $('#folio-thumbs').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.onclick = () => {
      const to = Number(button.dataset.folioSpread); closeFolio(); actions.onNavigate(to);
    });
    $('#folio-go').textContent = preview === 0 ? '翻到封面' : `翻到 ${pageName(preview)}`;
  }
  function closeFolio() {
    $('#folio').hidden = true; $('#folio-toggle').setAttribute('aria-expanded', 'false');
  }
  function toggleFolio() {
    if (!$('#folio').hidden) { closeFolio(); return; }
    directory.hidden = true; $('#cContents').setAttribute('aria-expanded', 'false');
    preview = state.spread; renderFolio(); $('#folio').hidden = false; $('#folio-toggle').setAttribute('aria-expanded', 'true');
    $<HTMLInputElement>('#folio-page').value = String(Math.min(LAST_PRINTED_PAGE, Math.max(1, (pdfAt(state.spread, 'left') ?? 6) - 5)));
    if (!state.reduced) $('#folio').animate([{ opacity: .6, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
    $('#folio-range').focus({ preventScroll: true });
  }
  $('#folio-toggle').onclick = toggleFolio;
  $('#folio-close').onclick = () => { closeFolio(); $('#folio-toggle').focus(); };
  $('#folio-range').oninput = () => { preview = Number($<HTMLInputElement>('#folio-range').value); renderFolio(); };
  $('#folio-go').onclick = () => { const to = preview; closeFolio(); actions.onNavigate(to); };
  $('#folio-jump').onsubmit = event => {
    event.preventDefault(); const page = Number($<HTMLInputElement>('#folio-page').value);
    if (!Number.isInteger(page) || page < 1 || page > LAST_PRINTED_PAGE) return;
    closeFolio(); actions.onNavigate(spreadAt(page + 5));
  };
  document.addEventListener('pointerdown', event => {
    if (!(event.target as Element).closest('#folio,#folio-toggle')) closeFolio();
  });
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && !$('#folio').hidden) { event.preventDefault(); event.stopImmediatePropagation(); closeFolio(); $('#folio-toggle').focus(); }
  }, true);

  return {
    update(next: WorkbenchState) {
      state = next; document.body.classList.toggle('workbench-playing', state.playing);
      document.body.classList.toggle('workbench-busy', state.busy);
      document.body.classList.toggle('workbench-reduced', state.reduced);
      $('#desk-header').setAttribute('aria-label', state.teacher ? '教师工作台' : '课本工作台');
      $('#desk-notes').setAttribute('aria-label', state.teacher ? '本页临时笔记' : '本页笔记');
      $('#cPause .control-name').textContent = state.playing ? '暂停' : '播放';
      $('#cNext .control-name').textContent = state.spread === 0 ? '翻开' : '下一页';
      $('#folio-location').textContent = pageName(state.spread);
      $('#folio-toggle').setAttribute('aria-label', `当前${pageName(state.spread)}，打开快速翻页`);
      const currentPdf = pdfAt(state.spread, 'right') ?? pdfAt(state.spread, 'left') ?? 2;
      const currentPage = currentPdf - 5;
      let currentChapter = -1;
      for (let i = 0; i < contents.length; i++) if (currentPage >= contents[i].page) currentChapter = i;
      for (const button of $('#chapter-tabs').querySelectorAll<HTMLButtonElement>('button')) {
        const current = Number(button.dataset.chapter) === currentChapter;
        if (current) button.setAttribute('aria-current', 'chapter'); else button.removeAttribute('aria-current');
      }
      if (lastSpread !== state.spread || !directory.hidden) {
        const candidates = [...chapterList.querySelectorAll<HTMLElement>('[data-pdf]')].filter(row => Number(row.dataset.pdf) <= currentPdf);
        const selected = candidates[candidates.length - 1];
        for (const row of chapterList.querySelectorAll<HTMLElement>('[data-pdf]')) {
          if (row === selected) row.setAttribute('aria-current', 'page'); else row.removeAttribute('aria-current');
        }
        lastSpread = state.spread;
      }
      for (const row of modelList.querySelectorAll<HTMLElement>('[data-figure]')) {
        if (row.dataset.figure === state.active) row.setAttribute('aria-current', 'page'); else row.removeAttribute('aria-current');
      }
    },
    syncContents(open: boolean) {
      $('#cContents').setAttribute('aria-expanded', String(open));
      if (!open) return;
      closeFolio();
      if (!state.reduced) directory.animate([{ transform: 'translateX(-24px)', opacity: .5 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.16,1,.3,1)' });
      const selected = (directoryView === 'chapters' ? chapterList : modelList).querySelector<HTMLElement>('[aria-current]');
      selected?.scrollIntoView({ block: 'nearest' });
      $('#contents-search').focus({ preventScroll: true });
    },
    closeFolio,
  };
}
