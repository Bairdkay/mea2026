// MEA 2026 COUNTDOWN

const eventDate = new Date("2026-11-07T00:00:00+02:00").getTime();

function updateCountdown() {
  const now = new Date().getTime();
  const difference = eventDate - now;

  if (difference <= 0) {
    document.getElementById("countdown").innerHTML =
      "<h3>THE BIG NIGHT IS HERE! 🎉</h3>";

    clearInterval(countdownInterval);
    return;
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((difference / (1000 * 60)) % 60);
  const seconds = Math.floor((difference / 1000) % 60);

  document.getElementById("days").textContent = String(days).padStart(2, "0");
  document.getElementById("hours").textContent = String(hours).padStart(2, "0");
  document.getElementById("minutes").textContent = String(minutes).padStart(2, "0");
  document.getElementById("seconds").textContent = String(seconds).padStart(2, "0");
}

updateCountdown();

const countdownInterval = setInterval(updateCountdown, 1000);