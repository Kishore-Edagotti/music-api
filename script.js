/* ========================================================
   SpotApi — script.js
   Spotify-Engineered Architecture
   Features: Home | Movies | Artists | Albums |
             Favorites | Playlists | Settings
======================================================== */

/* -------------------------------------------------------
   STATE
------------------------------------------------------- */
let audio = null;
let songsList = [];
let currentIndex = -1;
let activeCategoryEl = null;
let currentSongData = null;
let isSearching = false;

// Persisted state (localStorage)
let favorites = JSON.parse(localStorage.getItem("sa_favorites") || "[]");
let playlists = JSON.parse(localStorage.getItem("sa_playlists") || "[]");
let settings  = JSON.parse(localStorage.getItem("sa_settings")  || JSON.stringify({
  autoplay: true,
  loop: false,
  shuffle: false,
  theme: "spotify",
  cardsPerRow: "2",
  defaultLang: "telugu movie songs",
}));

/* -------------------------------------------------------
   DOM REFS
------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const categoryContainer   = $("categories");
const searchBtn           = $("search");
const songInput           = $("songInput");
const songCtrlBtn         = $("play-pause-btn");
const iconPlay            = $("iconPlay");
const iconPause           = $("iconPause");
const volumeSlider        = $("volumeSlider");
const volumeFill          = $("volumeFill");
const progressBar         = $("status");
const progressFill        = $("progressFill");
const mobileProgressFill  = $("mobileProgressFill");
const timeLabel           = $("timeLabel");
const currentTimeLabel    = $("currentTime");
const backwardBtn         = $("backward-btn");
const forwardBtn          = $("forward-btn");
const shuffleBtn          = $("shuffleBtn");
const loopBtn             = $("loopBtn");
const nowPlayingArt       = $("nowPlayingArt");
const nowPlayingTitle     = $("nowPlayingTitle");
const nowPlayingArtist    = $("nowPlayingArtist");
const nowPlayingFav       = $("nowPlayingFav");
const favHeartOutline     = $("favHeartOutline");
const favHeartFilled      = $("favHeartFilled");
const hamburger           = $("hamburger");
const sidebar             = $("sidebar");
const sidebarOverlay      = $("sidebarOverlay");
const closeSidebarBtn     = $("closeSidebar");
const toast               = $("toast");
const modalOverlay        = $("modalOverlay");
const modalPlaylistList   = $("modalPlaylistList");
const modalClose          = $("modalClose");
const modalCloseIcon      = $("modalCloseIcon");
const favoritesGrid       = $("favoritesGrid");
const favoritesEmpty      = $("favoritesEmpty");
const playlistsContainer   = $("playlistsContainer");

/* -------------------------------------------------------
   INITIALIZATION
------------------------------------------------------- */
applySettings();
defaultHomeSongs();
renderFavorites();
renderPlaylists();
bindSettings();

// Init fill bars
if (volumeFill && volumeSlider) volumeFill.style.width = "100%";
if (progressFill) progressFill.style.width = "0%";
if (mobileProgressFill) mobileProgressFill.style.width = "0%";

/* -------------------------------------------------------
   NAVIGATION
------------------------------------------------------- */
const navItems    = document.querySelectorAll(".nav-item");
const bnavBtns    = document.querySelectorAll(".bnav-btn");
const pageSections = document.querySelectorAll(".page-section");

function navigateTo(section) {
  // Sidebar items
  navItems.forEach(el => {
    el.classList.toggle("active", el.dataset.section === section);
  });
  // Bottom nav
  bnavBtns.forEach(el => {
    el.classList.toggle("active", el.dataset.section === section);
  });
  // Pages
  pageSections.forEach(el => {
    el.classList.toggle("active", el.id === "section-" + section);
  });

  // Lazy-load sections
  if (section === "movies")    loadMovies();
  if (section === "albums")    loadAlbums();
  if (section === "favorites") renderFavorites();
  if (section === "playlists") renderPlaylists();

  // Close mobile drawer if opened
  closeSidebar();
}

navItems.forEach(el => {
  el.addEventListener("click", () => navigateTo(el.dataset.section));
});
bnavBtns.forEach(el => {
  el.addEventListener("click", () => navigateTo(el.dataset.section));
});

const topHomeBtn = $("topHomeBtn");
if (topHomeBtn) topHomeBtn.addEventListener("click", () => navigateTo("home"));

/* -------------------------------------------------------
   SIDEBAR (MOBILE DRAWER)
------------------------------------------------------- */
if (hamburger) {
  hamburger.addEventListener("click", () => {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("open");
  });
}
function closeSidebar() {
  if (sidebar) sidebar.classList.remove("open");
  if (sidebarOverlay) sidebarOverlay.classList.remove("open");
}
if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

/* -------------------------------------------------------
   SEARCH
------------------------------------------------------- */
if (searchBtn) searchBtn.addEventListener("click", handleSearch);
if (songInput) {
  songInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });
}

async function handleSearch() {
  const q = songInput.value.trim();
  if (!q) {
    showToast("Enter a search term");
    return;
  }

  isSearching = true;
  navigateTo("home");
  showSkeletons(categoryContainer, 8);

  try {
    const data = await searchSong(q, 24);
    const results = (data.results || []).filter(s => s.previewUrl);
    if (!results.length) {
      categoryContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <p>No results found for "${escHtml(q)}"</p>
          <span class="empty-sub">Please make sure your words are spelled correctly or use different keywords.</span>
        </div>`;
      return;
    }
    songsList = results;
    currentIndex = -1;
    renderSongs(songsList, categoryContainer);
  } catch (err) {
    console.error("Search error:", err);
    showToast("Search failed — check your network connection");
    categoryContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <p>Something went wrong</p>
        <span class="empty-sub">Check your connection and try again.</span>
      </div>`;
  } finally {
    isSearching = false;
  }
}

/* -------------------------------------------------------
   iTunes API
------------------------------------------------------- */
async function searchSong(term, limit = 20) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/* -------------------------------------------------------
   HOME (TRENDING)
------------------------------------------------------- */
async function defaultHomeSongs() {
  if (isSearching) return;
  showSkeletons(categoryContainer, 10);
  const lang = settings.defaultLang || "telugu movie songs";
  try {
    const data = await searchSong(lang, 24);
    if (isSearching) return;
    songsList = (data.results || []).filter(s => s.previewUrl);
    renderSongs(songsList, categoryContainer);
  } catch (err) {
    console.error("Home load error:", err);
    if (!isSearching) {
      categoryContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p>Couldn't load tracks</p>
          <span class="empty-sub">Check your internet connection and refresh the page.</span>
        </div>`;
    }
  }
}

/* -------------------------------------------------------
   MOVIES SECTION
------------------------------------------------------- */
let moviesLoaded = false;
async function loadMovies() {
  if (moviesLoaded) return;
  moviesLoaded = true;
  const active = document.querySelector("#movieTabs .pill.active");
  await fetchMovieTab(active?.dataset.query || "telugu movie songs");
}

async function fetchMovieTab(query) {
  const container = $("movieCategories");
  showSkeletons(container, 8);
  try {
    const data = await searchSong(query, 24);
    const songs = (data.results || []).filter(s => s.previewUrl);
    renderSongs(songs, container);
    songsList = songs;
  } catch (err) {
    console.error("Movies load error:", err);
    container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>Failed to load soundtrack tracks</p></div>`;
  }
}

document.querySelectorAll("#movieTabs .pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("#movieTabs .pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    moviesLoaded = false;
    fetchMovieTab(pill.dataset.query);
  });
});

/* -------------------------------------------------------
   ARTISTS SECTION
------------------------------------------------------- */
document.querySelectorAll(".artist-card").forEach(card => {
  card.addEventListener("click", async () => {
    document.querySelectorAll(".artist-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
    const artistSongs = $("artistSongs");
    artistSongs.classList.remove("hidden");
    showSkeletons(artistSongs, 8);
    try {
      const data = await searchSong(card.dataset.query, 24);
      const songs = (data.results || []).filter(s => s.previewUrl);
      renderSongs(songs, artistSongs);
      songsList = songs;
      artistSongs.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      artistSongs.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>Failed to load artist tracks</p></div>`;
    }
  });
});

/* -------------------------------------------------------
   ALBUMS SECTION
------------------------------------------------------- */
let albumsLoaded = false;
async function loadAlbums() {
  if (albumsLoaded) return;
  albumsLoaded = true;
  const active = document.querySelector("#albumTabs .pill.active");
  await fetchAlbumTab(active?.dataset.query || "best album 2024");
}

async function fetchAlbumTab(query) {
  const container = $("albumCategories");
  showSkeletons(container, 8);
  try {
    const data = await searchSong(query, 24);
    const songs = (data.results || []).filter(s => s.previewUrl);
    renderSongs(songs, container);
    songsList = songs;
  } catch (err) {
    console.error("Albums load error:", err);
    container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>Failed to load albums</p></div>`;
  }
}

document.querySelectorAll("#albumTabs .pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("#albumTabs .pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    albumsLoaded = false;
    fetchAlbumTab(pill.dataset.query);
  });
});

/* -------------------------------------------------------
   SPOTIFY-GRADE CARD RENDERER
------------------------------------------------------- */
function renderSongs(songs, container) {
  container.innerHTML = "";
  if (!songs.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
        </div>
        <p>No tracks available</p>
      </div>`;
    return;
  }

  songs.forEach((song, index) => {
    const isFaved = isFavorite(song.trackId);
    const div = document.createElement("div");
    div.className = "category";

    const artSmall = song.artworkUrl100 || "./assets/music.png";
    const artLarge = artSmall.replace("100x100bb.jpg", "300x300bb.jpg");

    div.innerHTML = `
      <div class="card-image-wrap">
        <img src="${artLarge}" alt="${escHtml(song.trackName)}" loading="lazy" onerror="this.src='./assets/music.png'" />
        <button class="card-play-btn" title="Play">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
        </button>
      </div>
      <div class="category-meta">
        <div class="category-title" title="${escHtml(song.trackName)}">${escHtml(song.trackName || "Unknown Track")}</div>
        <div class="category-artist" title="${escHtml(song.artistName)}">${escHtml(song.artistName || "Unknown Artist")}</div>
      </div>
      <div class="category-actions">
        <button class="card-btn fav-card-btn ${isFaved ? "faved" : ""}" title="${isFaved ? "Remove from Liked Songs" : "Save to Liked Songs"}" data-id="${song.trackId}">
          <svg viewBox="0 0 24 24" fill="${isFaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <button class="card-btn playlist-card-btn" title="Add to playlist" data-index="${index}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>`;

    // Click anywhere on card (except buttons) to play
    div.addEventListener("click", (e) => {
      if (e.target.closest(".fav-card-btn") || e.target.closest(".playlist-card-btn")) return;
      songsList = songs;
      currentIndex = index;
      setActiveCard(div);
      playSong(song);
    });

    // Favorite button
    const favBtn = div.querySelector(".fav-card-btn");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(song);
      const faved = isFavorite(song.trackId);
      favBtn.classList.toggle("faved", faved);
      const svg = favBtn.querySelector("svg");
      if (svg) svg.setAttribute("fill", faved ? "currentColor" : "none");
      if (currentSongData?.trackId === song.trackId) updateNowPlayingFavBtn();
      showToast(faved ? "Added to Liked Songs" : "Removed from Liked Songs");
    });

    // Playlist button
    const plBtn = div.querySelector(".playlist-card-btn");
    plBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPlaylistModal(song);
    });

    container.appendChild(div);
  });
}

/* -------------------------------------------------------
   PLAYBACK ENGINE
------------------------------------------------------- */
function setPlayingState(playing) {
  if (iconPlay) iconPlay.style.display = playing ? "none" : "block";
  if (iconPause) iconPause.style.display = playing ? "block" : "none";
}

function playSong(song) {
  if (audio) {
    audio.pause();
    audio.removeEventListener("timeupdate", updateProgress);
    audio.removeEventListener("ended", onSongEnded);
  }

  currentSongData = song;
  audio = new Audio(song.previewUrl);
  audio.volume = Number(volumeSlider ? volumeSlider.value : 1);
  audio.loop = settings.loop;
  audio.play().catch(err => {
    console.warn("Playback autoplay restrictions:", err);
  });

  // Update Now Playing Bar info
  const artUrl = song.artworkUrl100?.replace("100x100bb.jpg", "300x300bb.jpg") || "./assets/music.png";
  if (nowPlayingArt) nowPlayingArt.src = artUrl;
  if (nowPlayingTitle) nowPlayingTitle.textContent = song.trackName || "Unknown Track";
  if (nowPlayingArtist) nowPlayingArtist.textContent = song.artistName || "Unknown Artist";
  updateNowPlayingFavBtn();

  setPlayingState(true);

  if (progressBar) {
    progressBar.value = 0;
    progressBar.max = 30;
  }
  if (progressFill) progressFill.style.width = "0%";
  if (mobileProgressFill) mobileProgressFill.style.width = "0%";
  if (currentTimeLabel) currentTimeLabel.textContent = "0:00";
  if (timeLabel) timeLabel.textContent = "0:30";

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("ended", onSongEnded);
}

function onSongEnded() {
  if (settings.loop) return;
  if (settings.autoplay) {
    playNextSong();
  } else {
    setPlayingState(false);
  }
}

/* Play/Pause Button */
if (songCtrlBtn) {
  songCtrlBtn.addEventListener("click", () => {
    if (!audio) {
      if (songsList.length > 0) {
        currentIndex = 0;
        playSong(songsList[0]);
      }
      return;
    }
    if (audio.paused) {
      audio.play();
      setPlayingState(true);
    } else {
      audio.pause();
      setPlayingState(false);
    }
  });
}

/* Forward / Backward / Shuffle / Loop */
if (forwardBtn) forwardBtn.addEventListener("click", playNextSong);
if (backwardBtn) backwardBtn.addEventListener("click", playPreviousSong);

function playNextSong() {
  if (!songsList.length) return;
  if (settings.shuffle) {
    currentIndex = Math.floor(Math.random() * songsList.length);
  } else {
    currentIndex = (currentIndex + 1) % songsList.length;
  }
  playSongAtIndex(currentIndex);
}

function playPreviousSong() {
  if (!songsList.length) return;
  if (audio && audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  currentIndex = (currentIndex - 1 + songsList.length) % songsList.length;
  playSongAtIndex(currentIndex);
}

function playSongAtIndex(idx) {
  const song = songsList[idx];
  if (!song) return;
  document.querySelectorAll(".category").forEach(c => c.classList.remove("active"));
  playSong(song);
}

if (shuffleBtn) {
  shuffleBtn.addEventListener("click", () => {
    settings.shuffle = !settings.shuffle;
    shuffleBtn.classList.toggle("active", settings.shuffle);
    const toggle = $("shuffleToggle");
    if (toggle) toggle.checked = settings.shuffle;
    saveSettings();
    showToast(settings.shuffle ? "Shuffle enabled" : "Shuffle disabled");
  });
}

if (loopBtn) {
  loopBtn.addEventListener("click", () => {
    settings.loop = !settings.loop;
    loopBtn.classList.toggle("active", settings.loop);
    const toggle = $("loopToggle");
    if (toggle) toggle.checked = settings.loop;
    if (audio) audio.loop = settings.loop;
    saveSettings();
    showToast(settings.loop ? "Repeat track enabled" : "Repeat disabled");
  });
}

/* -------------------------------------------------------
   VOLUME & PROGRESS
------------------------------------------------------- */
function updateRangeFill(fillEl, inputEl) {
  if (!fillEl || !inputEl) return;
  const min = Number(inputEl.min) || 0;
  const max = Number(inputEl.max) || 1;
  const pct = ((Number(inputEl.value) - min) / (max - min)) * 100;
  fillEl.style.width = pct + "%";
}

if (volumeSlider) {
  volumeSlider.addEventListener("input", () => {
    if (audio) audio.volume = Number(volumeSlider.value);
    updateRangeFill(volumeFill, volumeSlider);
  });
}

if (progressBar) {
  progressBar.addEventListener("input", () => {
    if (audio) audio.currentTime = Math.min(Number(progressBar.value), 30);
    updateRangeFill(progressFill, progressBar);
    if (mobileProgressFill) updateRangeFill(mobileProgressFill, progressBar);
  });
}

function updateProgress() {
  if (!audio) return;
  const cur = Math.min(audio.currentTime, 30);
  if (progressBar) {
    progressBar.value = cur;
    updateRangeFill(progressFill, progressBar);
    if (mobileProgressFill) updateRangeFill(mobileProgressFill, progressBar);
  }
  if (currentTimeLabel) currentTimeLabel.textContent = formatTime(cur);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function setActiveCard(el) {
  if (activeCategoryEl) activeCategoryEl.classList.remove("active");
  activeCategoryEl = el;
  if (el) el.classList.add("active");
}

/* -------------------------------------------------------
   FAVORITES
------------------------------------------------------- */
function isFavorite(id) {
  return favorites.some(f => f.trackId === id);
}

function toggleFavorite(song) {
  if (isFavorite(song.trackId)) {
    favorites = favorites.filter(f => f.trackId !== song.trackId);
  } else {
    favorites.push(song);
  }
  localStorage.setItem("sa_favorites", JSON.stringify(favorites));
  renderFavorites();
}

function renderFavorites() {
  if (!favoritesGrid) return;
  favoritesGrid.innerHTML = "";
  if (!favorites.length) {
    if (favoritesEmpty) favoritesEmpty.style.display = "flex";
    favoritesGrid.style.display = "none";
  } else {
    if (favoritesEmpty) favoritesEmpty.style.display = "none";
    favoritesGrid.style.display = "grid";
    renderSongs(favorites, favoritesGrid);
  }
}

function updateNowPlayingFavBtn() {
  if (!currentSongData || !nowPlayingFav) return;
  const faved = isFavorite(currentSongData.trackId);
  nowPlayingFav.classList.toggle("faved", faved);
  if (favHeartOutline) favHeartOutline.style.display = faved ? "none" : "block";
  if (favHeartFilled) favHeartFilled.style.display = faved ? "block" : "none";
}

if (nowPlayingFav) {
  nowPlayingFav.addEventListener("click", () => {
    if (!currentSongData) return;
    toggleFavorite(currentSongData);
    updateNowPlayingFavBtn();
    showToast(isFavorite(currentSongData.trackId) ? "Added to Liked Songs" : "Removed from Liked Songs");
  });
}

/* -------------------------------------------------------
   PLAYLISTS
------------------------------------------------------- */
const createPlaylistBtn = $("createPlaylistBtn");
if (createPlaylistBtn) {
  createPlaylistBtn.addEventListener("click", () => {
    const nameInput = $("newPlaylistName");
    const name = nameInput ? nameInput.value.trim() : "";
    if (!name) {
      showToast("Enter a playlist name");
      return;
    }
    playlists.push({ id: Date.now(), name, songs: [] });
    savePlaylists();
    renderPlaylists();
    if (nameInput) nameInput.value = "";
    showToast(`Playlist "${name}" created`);
  });
}

function savePlaylists() {
  localStorage.setItem("sa_playlists", JSON.stringify(playlists));
}

function renderPlaylists() {
  if (!playlistsContainer) return;
  playlistsContainer.innerHTML = "";
  if (!playlists.length) {
    playlistsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg>
        </div>
        <p>No playlists yet</p>
        <span class="empty-sub">Create your first playlist using the form above.</span>
      </div>`;
    return;
  }

  playlists.forEach(pl => {
    const item = document.createElement("div");
    item.className = "playlist-item";
    item.innerHTML = `
      <div class="playlist-header" data-id="${pl.id}">
        <div class="playlist-header-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
          ${escHtml(pl.name)}
          <span class="playlist-count">(${pl.songs.length} ${pl.songs.length === 1 ? "song" : "songs"})</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="delete-playlist-btn" data-id="${pl.id}" title="Delete playlist" aria-label="Delete playlist">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
          <span class="playlist-toggle">&#9662;</span>
        </div>
      </div>
      <div class="playlist-songs" id="pl-songs-${pl.id}">
        ${pl.songs.length
          ? pl.songs.map((s, i) => `
              <div class="playlist-song-row" data-index="${i}">
                <img src="${s.artworkUrl100 || './assets/music.png'}" alt="${escHtml(s.trackName)}" />
                <div class="psr-info">
                  <div class="psr-title">${escHtml(s.trackName || "Unknown Track")}</div>
                  <div class="psr-artist">${escHtml(s.artistName || "Unknown Artist")}</div>
                </div>
                <button class="psr-remove" data-pl="${pl.id}" data-track="${s.trackId}" title="Remove track" aria-label="Remove">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>`).join("")
          : `<p style="color:var(--sp-text-subdued);font-size:0.85rem;padding:8px 0;">No songs in this playlist yet.</p>`
        }
      </div>`;

    // Toggle expand/collapse
    const header = item.querySelector(".playlist-header");
    header.addEventListener("click", (e) => {
      if (e.target.closest(".delete-playlist-btn")) return;
      const songsEl = $(`pl-songs-${pl.id}`);
      const toggle = item.querySelector(".playlist-toggle");
      if (songsEl) songsEl.classList.toggle("open");
      if (toggle) toggle.classList.toggle("open");
    });

    // Delete playlist
    const delBtn = item.querySelector(".delete-playlist-btn");
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        playlists = playlists.filter(p => p.id !== pl.id);
        savePlaylists();
        renderPlaylists();
        showToast("Playlist deleted");
      });
    }

    // Play tracks inside playlist
    item.querySelectorAll(".playlist-song-row").forEach((row, i) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".psr-remove")) return;
        songsList = pl.songs;
        currentIndex = i;
        playSong(pl.songs[i]);
      });
    });

    // Remove individual track
    item.querySelectorAll(".psr-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const plId = Number(btn.dataset.pl);
        const trackId = Number(btn.dataset.track);
        const target = playlists.find(p => p.id === plId);
        if (target) target.songs = target.songs.filter(s => s.trackId !== trackId);
        savePlaylists();
        renderPlaylists();
        showToast("Track removed from playlist");
      });
    });

    playlistsContainer.appendChild(item);
  });
}

/* -------------------------------------------------------
   ADD TO PLAYLIST MODAL
------------------------------------------------------- */
function openPlaylistModal(song) {
  if (!modalPlaylistList) return;
  modalPlaylistList.innerHTML = "";
  if (!playlists.length) {
    modalPlaylistList.innerHTML = `<p style="color:var(--sp-text-subdued);font-size:0.9rem;padding:12px 0;">No playlists yet. Create one in the Playlists tab first.</p>`;
  } else {
    playlists.forEach(pl => {
      const btn = document.createElement("button");
      btn.className = "modal-playlist-btn";
      btn.textContent = `${pl.name} (${pl.songs.length} tracks)`;
      btn.addEventListener("click", () => {
        addSongToPlaylist(pl.id, song);
        if (modalOverlay) modalOverlay.classList.remove("open");
        showToast(`Added to "${pl.name}"`);
      });
      modalPlaylistList.appendChild(btn);
    });
  }
  if (modalOverlay) modalOverlay.classList.add("open");
}

function addSongToPlaylist(plId, song) {
  const pl = playlists.find(p => p.id === plId);
  if (!pl) return;
  if (pl.songs.some(s => s.trackId === song.trackId)) {
    showToast("Track already in playlist");
    return;
  }
  pl.songs.push(song);
  savePlaylists();
  renderPlaylists();
}

if (modalClose) modalClose.addEventListener("click", () => modalOverlay && modalOverlay.classList.remove("open"));
if (modalCloseIcon) modalCloseIcon.addEventListener("click", () => modalOverlay && modalOverlay.classList.remove("open"));
if (modalOverlay) {
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove("open");
  });
}

/* -------------------------------------------------------
   SETTINGS BINDING
------------------------------------------------------- */
function bindSettings() {
  const autoplayToggle  = $("autoplayToggle");
  const loopToggle      = $("loopToggle");
  const shuffleToggle   = $("shuffleToggle");
  const themeSelect     = $("themeSelect");
  const cardsPerRow     = $("cardsPerRow");
  const defaultLang     = $("defaultLang");
  const clearFavBtn     = $("clearFavBtn");
  const clearPlaylistsBtn = $("clearPlaylistsBtn");

  if (autoplayToggle) autoplayToggle.checked = settings.autoplay;
  if (loopToggle)     loopToggle.checked = settings.loop;
  if (shuffleToggle)  shuffleToggle.checked = settings.shuffle;
  if (themeSelect)    themeSelect.value = settings.theme;
  if (cardsPerRow)    cardsPerRow.value = settings.cardsPerRow;
  if (defaultLang)    defaultLang.value = settings.defaultLang;

  if (shuffleBtn) shuffleBtn.classList.toggle("active", settings.shuffle);
  if (loopBtn)    loopBtn.classList.toggle("active", settings.loop);

  if (autoplayToggle) {
    autoplayToggle.addEventListener("change", () => {
      settings.autoplay = autoplayToggle.checked;
      saveSettings();
    });
  }
  if (loopToggle) {
    loopToggle.addEventListener("change", () => {
      settings.loop = loopToggle.checked;
      if (loopBtn) loopBtn.classList.toggle("active", settings.loop);
      if (audio) audio.loop = settings.loop;
      saveSettings();
    });
  }
  if (shuffleToggle) {
    shuffleToggle.addEventListener("change", () => {
      settings.shuffle = shuffleToggle.checked;
      if (shuffleBtn) shuffleBtn.classList.toggle("active", settings.shuffle);
      saveSettings();
    });
  }
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      settings.theme = themeSelect.value;
      applySettings();
      saveSettings();
    });
  }
  if (cardsPerRow) {
    cardsPerRow.addEventListener("change", () => {
      settings.cardsPerRow = cardsPerRow.value;
      applySettings();
      saveSettings();
    });
  }
  if (defaultLang) {
    defaultLang.addEventListener("change", () => {
      settings.defaultLang = defaultLang.value;
      saveSettings();
    });
  }
  if (clearFavBtn) {
    clearFavBtn.addEventListener("click", () => {
      if (!favorites.length) {
        showToast("No Liked Songs to clear");
        return;
      }
      favorites = [];
      localStorage.removeItem("sa_favorites");
      renderFavorites();
      updateNowPlayingFavBtn();
      showToast("Liked Songs cleared");
    });
  }
  if (clearPlaylistsBtn) {
    clearPlaylistsBtn.addEventListener("click", () => {
      if (!playlists.length) {
        showToast("No playlists to clear");
        return;
      }
      playlists = [];
      savePlaylists();
      renderPlaylists();
      showToast("Playlists cleared");
    });
  }
}

function applySettings() {
  document.documentElement.dataset.theme = settings.theme === "spotify" ? "" : settings.theme;
  const sizeMap = { "1": "240px", "2": "180px", "3": "150px" };
  const minWidth = sizeMap[settings.cardsPerRow] || "180px";
  document.documentElement.style.setProperty("--sp-card-min", minWidth);
}

function saveSettings() {
  localStorage.setItem("sa_settings", JSON.stringify(settings));
}

/* -------------------------------------------------------
   SKELETON SHIMMER LOADING
------------------------------------------------------- */
function showSkeletons(container, count = 8) {
  if (!container) return;
  container.innerHTML = Array(count).fill('<div class="skeleton-card"></div>').join("");
}

/* -------------------------------------------------------
   TOAST NOTIFICATION
------------------------------------------------------- */
let toastTimer;
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */
function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
