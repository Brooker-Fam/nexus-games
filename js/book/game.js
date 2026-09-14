// ── THE BOOK ──
// Chapters unlock one per week starting from BOOK_START_DATE.

const BOOK_START_DATE = new Date('2026-09-14T00:00:00Z');
const BOOK_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BOOK_LAST_CHAPTER_KEY = 'nexus_book_last_chapter';

let bookSelectedChapter = null;

function bookFlatChapters(){
  const flat = [];
  for(const part of BOOK_DATA.parts){
    for(const chapter of part.chapters){
      flat.push({ chapter, partTitle: part.title });
    }
  }
  return flat;
}

// How many chapters are unlocked right now (at least 1, capped at total).
function bookUnlockedCount(){
  const elapsed = Date.now() - BOOK_START_DATE.getTime();
  const weeksElapsed = elapsed < 0 ? 0 : Math.floor(elapsed / BOOK_WEEK_MS);
  return Math.max(1, Math.min(BOOK_TOTAL_CHAPTERS, weeksElapsed + 1));
}

function bookUnlockDate(chapterNumber){
  return new Date(BOOK_START_DATE.getTime() + (chapterNumber - 1) * BOOK_WEEK_MS);
}

// Nexus Pro members (see js/shared/memberships.js) get every chapter
// immediately instead of waiting for its weekly release.
function bookIsUnlocked(chapterNumber){
  return !!window.nexusProActive || chapterNumber <= bookUnlockedCount();
}

function bookFormatDate(date){
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function bookDaysUntil(date){
  const ms = date.getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function renderBookCountdown(){
  const el = document.getElementById('book-countdown');
  if(window.nexusProActive){
    el.textContent = '★ NEXUS PRO — all ' + BOOK_TOTAL_CHAPTERS + ' chapters are unlocked.';
    return;
  }
  const unlocked = bookUnlockedCount();
  if(unlocked >= BOOK_TOTAL_CHAPTERS){
    el.textContent = 'All ' + BOOK_TOTAL_CHAPTERS + ' chapters are available.';
    return;
  }
  const nextChapter = unlocked + 1;
  const nextDate = bookUnlockDate(nextChapter);
  const days = bookDaysUntil(nextDate);
  el.textContent = 'Chapter ' + nextChapter + ' unlocks in ' + days + ' day' + (days === 1 ? '' : 's') +
    ' — ' + bookFormatDate(nextDate);
}

function renderBookList(){
  const col = document.getElementById('book-list-col');
  col.innerHTML = '';
  for(const part of BOOK_DATA.parts){
    if(part.title){
      const label = document.createElement('div');
      label.className = 'book-list-section-label';
      label.textContent = '◆ ' + part.title.toUpperCase();
      col.appendChild(label);
    }
    const ul = document.createElement('ul');
    ul.className = 'book-list';
    for(const chapter of part.chapters){
      const unlocked = bookIsUnlocked(chapter.number);
      const li = document.createElement('li');
      li.className = 'book-list-item' + (unlocked ? '' : ' locked') +
        (bookSelectedChapter === chapter.number ? ' selected' : '');
      li.dataset.chapter = chapter.number;
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-pressed', bookSelectedChapter === chapter.number ? 'true' : 'false');
      if(unlocked){
        li.textContent = chapter.title;
      } else {
        li.innerHTML = '<span class="book-lock-icon">🔒</span> ' + chapter.title;
        li.title = 'Unlocks ' + bookFormatDate(bookUnlockDate(chapter.number));
      }
      li.addEventListener('click', () => selectBookChapter(chapter.number));
      li.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          selectBookChapter(chapter.number);
        }
      });
      ul.appendChild(li);
    }
    col.appendChild(ul);
  }
}

function renderBookReader(){
  const reader = document.getElementById('book-reader');
  reader.innerHTML = '';

  const flat = bookFlatChapters();
  const entry = flat.find(f => f.chapter.number === bookSelectedChapter);
  if(!entry){
    reader.innerHTML = '<div class="book-empty">Select a chapter to begin reading.</div>';
    return;
  }

  const { chapter, partTitle } = entry;

  if(!bookIsUnlocked(chapter.number)){
    const unlockDate = bookUnlockDate(chapter.number);
    reader.innerHTML =
      '<div class="book-locked-panel">' +
        '<div class="book-lock-icon book-lock-icon-big">🔒</div>' +
        '<div class="book-locked-title">' + chapter.title + ' is locked</div>' +
        '<div class="book-locked-sub">Unlocks ' + bookFormatDate(unlockDate) +
          ' (in ' + bookDaysUntil(unlockDate) + ' day' + (bookDaysUntil(unlockDate) === 1 ? '' : 's') + ')</div>' +
      '</div>';
    return;
  }

  const header = document.createElement('div');
  header.className = 'book-reader-header';
  header.innerHTML =
    '<div class="book-reader-part">' + (partTitle || '') + '</div>' +
    '<div class="book-reader-title">' + chapter.title + '</div>';
  reader.appendChild(header);

  for(const para of chapter.paragraphs){
    if(para.type === 'break'){
      const hr = document.createElement('div');
      hr.className = 'book-scene-break';
      hr.textContent = '✦ ✦ ✦';
      reader.appendChild(hr);
    } else if(para.type === 'quote'){
      const q = document.createElement('div');
      q.className = 'book-quote';
      q.textContent = para.text;
      reader.appendChild(q);
    } else {
      const p = document.createElement('p');
      p.className = 'book-paragraph';
      p.textContent = para.text;
      reader.appendChild(p);
    }
  }

  const nav = document.createElement('div');
  nav.className = 'book-reader-nav';
  const prevBtn = document.createElement('button');
  prevBtn.className = 'book-nav-btn';
  prevBtn.textContent = '← PREVIOUS';
  prevBtn.disabled = chapter.number <= 1;
  prevBtn.onclick = () => selectBookChapter(chapter.number - 1);
  const nextBtn = document.createElement('button');
  nextBtn.className = 'book-nav-btn';
  const nextUnlocked = chapter.number < BOOK_TOTAL_CHAPTERS && bookIsUnlocked(chapter.number + 1);
  nextBtn.textContent = chapter.number >= BOOK_TOTAL_CHAPTERS ? 'THE END' : (nextUnlocked ? 'NEXT →' : '🔒 NEXT WEEK');
  nextBtn.disabled = chapter.number >= BOOK_TOTAL_CHAPTERS || !nextUnlocked;
  nextBtn.onclick = () => selectBookChapter(chapter.number + 1);
  nav.appendChild(prevBtn);
  nav.appendChild(nextBtn);
  reader.appendChild(nav);

  reader.scrollTop = 0;
}

function selectBookChapter(chapterNumber){
  bookSelectedChapter = chapterNumber;
  try { localStorage.setItem(BOOK_LAST_CHAPTER_KEY, String(chapterNumber)); } catch(e){}
  renderBookList();
  renderBookReader();
  if(window.posthog) posthog.capture('book_chapter_selected', { chapter: chapterNumber, unlocked: bookIsUnlocked(chapterNumber) });
}

function bookInitialChapter(){
  const unlocked = bookUnlockedCount();
  let stored = null;
  try {
    const raw = localStorage.getItem(BOOK_LAST_CHAPTER_KEY);
    if(raw) stored = parseInt(raw, 10);
  } catch(e){}
  if(stored && stored >= 1 && stored <= unlocked) return stored;
  return unlocked;
}

registerGame('book', {
  init(){
    if(bookSelectedChapter === null) bookSelectedChapter = bookInitialChapter();
    renderBookCountdown();
    renderBookList();
    renderBookReader();
  },
  cleanup(){},
});

//# sourceMappingURL=game.js.map
