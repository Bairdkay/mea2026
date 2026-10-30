/* ==================================
   MEA 2026 COUNTDOWN SYSTEM
   Malawi Time (CAT UTC+2)
================================== */

// Official MEA dates
const nominationEnd = new Date(
  "2026-11-08T00:00:00+02:00"
).getTime();

const votingStart = new Date(
  "2026-11-15T00:00:00+02:00"
).getTime();

const votingEnd = new Date(
  "2026-12-21T00:00:00+02:00"
).getTime();

const awardsDate = new Date(
  "2026-12-27T00:00:00+02:00"
).getTime();

const pad = value => String(value).padStart(2, "0");

function getTime(target) {
  const difference = target - Date.now();

  return {
    difference,
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference / 3600000) % 24),
    minutes: Math.floor((difference / 60000) % 60),
    seconds: Math.floor((difference / 1000) % 60)
  };
}

function displayTime(prefix, target) {
  const time = getTime(target);

  const days = document.getElementById(prefix + "days");
  const hours = document.getElementById(prefix + "hours");
  const minutes = document.getElementById(prefix + "minutes");
  const seconds = document.getElementById(prefix + "seconds");

  if (!days || !hours || !minutes || !seconds) return;

  days.textContent = pad(Math.max(0, time.days));
  hours.textContent = pad(Math.max(0, time.hours));
  minutes.textContent = pad(Math.max(0, time.minutes));
  seconds.textContent = pad(Math.max(0, time.seconds));
}

// NOMINATION COUNTDOWN
function updateNomination() {
  const timer = document.getElementById("nomination-timer");
  if (!timer) return;

  if (Date.now() >= nominationEnd) {
    timer.innerHTML = "<h3>NOMINATIONS ARE CLOSED!</h3>";
    return;
  }

  displayTime("nom-", nominationEnd);
}

// VOTING COUNTDOWN
function updateVoting() {
  const timer = document.getElementById("voting-timer");
  const title = document.getElementById("voting-title");
  const message = document.getElementById("voting-message");

  if (!timer || !title || !message) return;

  const now = Date.now();

  if (now < votingStart) {
    title.textContent = "Voting Opens In";
    timer.style.display = "grid";

    message.textContent =
      "Public voting starts on 15 November 2026.";

    message.className = "voting-message";

    displayTime("vote-", votingStart);

  } else if (now < votingEnd) {
    title.textContent = "Public Voting";
    timer.style.display = "none";

    message.textContent =
      "🗳️ VOTING IS NOW OPEN! CAST YOUR VOTE TODAY.";

    message.className = "voting-message is-open";

  } else {
    title.textContent = "Voting Closed";
    timer.style.display = "none";

    message.textContent =
      "VOTING HAS CLOSED. THANK YOU FOR PARTICIPATING!";

    message.className = "voting-message is-closed";
  }
}

// AWARDS CEREMONY COUNTDOWN
function updateAwards() {
  const timer = document.getElementById("countdown");
  if (!timer) return;

  if (Date.now() >= awardsDate) {
    timer.innerHTML =
      "<h3>THE MEA AWARDS ARE HERE! 🏆</h3>";
    return;
  }

  displayTime("", awardsDate);
}

// UPDATE EVERYTHING
function updateAll() {
  updateNomination();
  updateVoting();
  updateAwards();
}

updateAll();

setInterval(updateAll, 1000);
