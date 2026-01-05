/* ===============================
   GLOBAL VARIABLES
================================ */
let audio = null;
let songsList = [];
let currentIndex = -1;
let activePoster = null;

const categoryContainer = document.getElementById("categories");
const searchBtn = document.getElementById("search");
const songInput = document.getElementById("songInput");
const songContrlBtn = document.getElementById("play-pause-btn");
const playPauseIcon = songContrlBtn.querySelector("img");
const volumeSlider = document.getElementById("volumeSlider");
const progressBar = document.getElementById("status");
const timeLabel = document.getElementById("timeLabel");
const homeBtn = document.getElementById("home");
const backwardBtn = document.getElementById("backward-btn");
const forwardBtn = document.getElementById("forward-btn");

/* ===============================
   DEFAULT HOME SONGS
================================ */
async function defaultHomeSongs() {
  const data = await searchSong("telugu movie songs ");
  songsList = data.results.filter((song) => song.previewUrl);
  handleSong(songsList);
}
defaultHomeSongs();

homeBtn.addEventListener("click", defaultHomeSongs);

/* ===============================
   SEARCH BUTTON
================================ */
searchBtn.addEventListener("click", async () => {
  const songName = songInput.value.trim();
  if (!songName) {
    alert("Enter a song name");
    return;
  }

  const data = await searchSong(songName);
  songsList = data.results.filter((song) => song.previewUrl);
  handleSong(songsList);
});

/* ===============================
   PLAY / PAUSE CONTROL
================================ */
songContrlBtn.addEventListener("click", () => {
  if (!audio) return;

  if (audio.paused) {
    audio.play();
    playPauseIcon.src = "./assets/pause.png";
  } else {
    audio.pause();
    playPauseIcon.src = "./assets/play-button.png";
  }
});

/* ===============================
   VOLUME CONTROL
================================ */
volumeSlider.addEventListener("input", () => {
  if (!audio) return;
  audio.volume = Number(volumeSlider.value);
});

/* ===============================
   SEARCH SONG (iTunes API)
================================ */
async function searchSong(songName) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
    songName
  )}&media=music&limit=15`;

  const response = await fetch(url);
  return await response.json();
}

/* ===============================
   RENDER SONGS
================================ */
function handleSong(data) {
  categoryContainer.innerHTML = "";
  console.log(data);
  activePoster = null;

  data.forEach((song, index) => {
    const categoryDiv = document.createElement("div");
    categoryDiv.className = "category";

    const img = document.createElement("img");
    img.src = song.artworkUrl100.replace("100x100bb.jpg", "600x600bb.jpg");
    img.alt = song.trackName;

    img.addEventListener("click", () => {
      currentIndex = index;
      setActivePoster(img);
      play30Sec(song.previewUrl);
    });

    categoryDiv.appendChild(img);
    categoryContainer.appendChild(categoryDiv);
  });
}

/* ===============================
   ACTIVE POSTER HIGHLIGHT
================================ */
function setActivePoster(img) {
  if (activePoster) {
    activePoster.classList.remove("active");
  }
  activePoster = img;
  activePoster.classList.add("active");
}

/* ===============================
   PLAY SONG
================================ */
function play30Sec(previewUrl) {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.removeEventListener("timeupdate", updateProgress);
  }

  audio = new Audio(previewUrl);
  audio.volume = Number(volumeSlider.value);
  audio.play();

  playPauseIcon.src = "./assets/pause.png";
  progressBar.value = 0;
  timeLabel.textContent = "0:00 / 0:30";

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("ended", playNextSong);
}

/* ===============================
   FORWARD / BACKWARD
================================ */
forwardBtn.addEventListener("click", playNextSong);
backwardBtn.addEventListener("click", playPreviousSong);

function playNextSong() {
  if (songsList.length === 0) return;

  currentIndex = (currentIndex + 1) % songsList.length;
  const song = songsList[currentIndex];

  const posters = document.querySelectorAll(".category img");
  setActivePoster(posters[currentIndex]);

  play30Sec(song.previewUrl);
}

function playPreviousSong() {
  if (songsList.length === 0) return;

  currentIndex = (currentIndex - 1 + songsList.length) % songsList.length;
  const song = songsList[currentIndex];

  const posters = document.querySelectorAll(".category img");
  setActivePoster(posters[currentIndex]);

  play30Sec(song.previewUrl);
}

/* ===============================
   PROGRESS BAR UPDATE
================================ */
function updateProgress() {
  if (!audio) return;

  const current = Math.min(audio.currentTime, 30);
  progressBar.value = current;
  timeLabel.textContent = `${formatTime(current)} / 0:30`;
}

/* ===============================
   SEEKING
================================ */
progressBar.addEventListener("input", () => {
  if (!audio) return;
  audio.currentTime = Math.min(progressBar.value, 30);
});

/* ===============================
   FORMAT TIME
================================ */
function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
