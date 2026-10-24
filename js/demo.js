// Interactive "try it" demo: a virtual keychain, a virtual phone and a timeline of what happens.
// Everything is simulated in the browser; nothing is sent anywhere.

const HOLD_MS = 2000;
const WINDOW_SEC = 10;
const PIN = '1234';
const DURESS_PIN = '9999';
const MAX_WRONG = 3;
const RING = 427; // circumference of the countdown ring
const MAP_LINK = 'maps.google.com/?q=28.6129,77.2295';

export function initDemo(root) {
  const $ = (sel) => root.querySelector(sel);
  const el = {
    device: $('[data-device]'),
    hold: $('[data-hold]'),
    hint: $('[data-device-hint]'),
    fall: $('[data-fall]'),
    voice: $('[data-voice]'),
    nearby: $('[data-phone-nearby]'),
    sound: $('[data-sound]'),
    screen: $('[data-screen]'),
    status: root.querySelector('.mock-status'),
    timeline: $('[data-timeline]'),
    contactView: $('[data-contact-view]'),
    sms: $('[data-sms]'),
    reset: $('[data-reset]'),
  };

  let state = 'idle';       // idle | countdown | active | silent
  let reason = '';
  let wrong = 0;
  let delivered = false;
  let secondsLeft = 0;
  let countdownTimer = null;
  let laterTimer = null;
  let holdTimer = null;

  // ---------- Siren sound (optional, quiet) ----------

  let audio = null;
  function sirenSound(on) {
    if (!on || !el.sound.checked) {
      if (audio) {
        clearInterval(audio.timer);
        audio.osc.stop();
        audio.ctx.close();
        audio = null;
      }
      return;
    }
    if (audio) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    osc.type = 'triangle';
    osc.frequency.value = 2200;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    const timer = setInterval(() => {
      osc.frequency.value = osc.frequency.value > 2500 ? 2200 : 3000;
    }, 300);
    audio = { ctx, osc, timer };
  }

  function siren(on) {
    el.device.classList.toggle('siren', on);
    sirenSound(on);
  }

  // ---------- Timeline ----------

  function log(text, kind = '') {
    const item = document.createElement('li');
    if (kind) item.className = kind;
    item.textContent = text;
    el.timeline.appendChild(item);
    el.timeline.scrollTop = el.timeline.scrollHeight;
  }

  function showSms(text) {
    el.contactView.hidden = false;
    el.sms.textContent = text;
  }

  // ---------- Phone screens ----------

  function setScreen(html, dark = false) {
    el.screen.innerHTML = html;
    el.status.classList.toggle('dark', dark);
  }

  function renderHome() {
    const nearby = el.nearby.checked;
    setScreen(`
      <div class="ms">
        <p class="hello">Hello, Priya</p>
        <p class="safe"><i></i>You’re safe</p>
        ${nearby ? '' : '<p class="banner-off">Safety Pear not connected</p>'}
        <button class="big-btn" data-app-sos>Tap to<br>activate</button>
        <div class="tiles">
          <div class="tile">Contacts<small>2 people</small></div>
          <div class="tile">Device<small>${nearby ? 'Connected' : 'Not connected'}</small></div>
        </div>
        <p class="note-line">Tap the pink button, or use the keychain</p>
      </div>`);
    el.screen.querySelector('[data-app-sos]').onclick = () => trigger('Triggered from the app');
  }

  function renderCountdown() {
    setScreen(`
      <div class="ms dark">
        <h4>Emergency Alert</h4>
        <p class="small-text">Activating…</p>
        <div class="ring">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle class="track" cx="80" cy="80" r="68"/>
            <circle class="progress" cx="80" cy="80" r="68" style="stroke-dashoffset:${RING * (1 - secondsLeft / WINDOW_SEC)}"/>
          </svg>
          <b data-secs>${secondsLeft}s</b>
        </div>
        <p class="reason">${reason}</p>
        <p class="small-text">When it reaches zero, your contacts and the control room get your live location.</p>
        <p class="wrong" data-wrong>${wrong ? `Wrong password ${wrong} of ${MAX_WRONG}` : ''}</p>
        <button class="ms-btn" data-cancel>Cancel</button>
      </div>`, true);
    el.screen.querySelector('[data-cancel]').onclick = () => openKeypad('Enter password to cancel');
  }

  function updateCountdown() {
    const secs = el.screen.querySelector('[data-secs]');
    const ring = el.screen.querySelector('.progress');
    if (secs) secs.textContent = `${secondsLeft}s`;
    if (ring) ring.style.strokeDashoffset = RING * (1 - secondsLeft / WINDOW_SEC);
  }

  function renderActive() {
    setScreen(`
      <div class="ms dark">
        <div class="sos-dot">SOS</div>
        <h4>SOS Sent</h4>
        <p class="small-text">Help is on the way. Move somewhere safe if you can.</p>
        <ul class="alerted">
          <li>Mom <em>✓ Alerted</em></li>
          <li>Riya <em>✓ Alerted</em></li>
          <li>Control room <em>✓ Alerted</em></li>
        </ul>
        <button class="ms-btn light" data-safe>I’m Safe</button>
      </div>`, true);
    el.screen.querySelector('[data-safe]').onclick = () => openKeypad('Enter password to confirm you’re safe');
  }

  function renderDone(text) {
    setScreen(`
      <div class="ms" style="align-items:center;justify-content:center;text-align:center">
        <div class="big-btn" style="width:110px;height:110px;margin:0 0 18px;background:#22a565;box-shadow:0 0 0 12px #dff3e8;font-size:48px">✓</div>
        <h4>${text}</h4>
      </div>`);
    clearTimeout(laterTimer);
    laterTimer = setTimeout(renderHome, 1800);
  }

  // ---------- Password pad ----------

  function openKeypad(title) {
    el.screen.querySelector('.keypad-sheet')?.remove();
    const sheet = document.createElement('div');
    sheet.className = 'keypad-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', title);
    sheet.innerHTML = `
      <p>${title}</p>
      <p class="hint">Try <b>1234</b> (cancel) or <b>9999</b> (emergency password)</p>
      <div class="dots"><span></span><span></span><span></span><span></span></div>
      <div class="keys">
        ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '✕', '0', '⌫'].map((k) => `<button type="button" data-key="${k}" aria-label="${{ '✕': 'Close', '⌫': 'Delete' }[k] || k}">${k}</button>`).join('')}
      </div>`;
    el.screen.appendChild(sheet);

    let pin = '';
    const dots = sheet.querySelectorAll('.dots span');
    const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
    sheet.querySelectorAll('[data-key]').forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        if (key === '✕') return sheet.remove();
        if (key === '⌫') pin = pin.slice(0, -1);
        else if (pin.length < 4) pin += key;
        paint();
        if (pin.length === 4) {
          const keep = handlePin(pin);
          if (keep) {
            sheet.querySelector('.dots').classList.add('shake');
            setTimeout(() => {
              sheet.querySelector('.dots')?.classList.remove('shake');
              pin = '';
              paint();
            }, 400);
          } else {
            sheet.remove();
          }
        }
      };
    });
    sheet.querySelector('[data-key="1"]').focus();
  }

  // Returns true to keep the keypad open (wrong password)
  function handlePin(pin) {
    if (pin === PIN) {
      const wasCountdown = state === 'countdown';
      stopAlarm();
      if (wasCountdown) {
        log('Cancelled in time with the password. Nothing was sent, and it doesn’t count as misuse.', 'good');
        renderDone('Alarm cancelled');
      } else {
        log('Marked safe. Everyone gets an “I’m safe now” message.', 'good');
        showSms('Priya: I’m safe now. 💚');
        renderDone('You’re marked safe');
      }
      return false;
    }

    if (pin === DURESS_PIN) {
      const wasCountdown = state === 'countdown';
      stopAlarm();
      state = 'silent';
      log('The screen shows “cancelled” and the siren stops. This is what an attacker sees.', 'hidden-info');
      log('Hidden: the emergency password was used, so the SOS continues silently.', 'hidden-info');
      log('Mom, Riya and the control room are told it’s a silent alert: don’t call, follow the live location.', 'alert');
      showSms(`🚨 Priya may be in danger and can’t talk freely. Don’t call. Live location: ${MAP_LINK}`);
      renderDone(wasCountdown ? 'Alarm cancelled' : 'You’re marked safe');
      el.hint.textContent = 'Looks normal, but help is on the way';
      log('Press “Reset demo” to try again.');
      return false;
    }

    wrong += 1;
    log(`Wrong password (${wrong} of ${MAX_WRONG}).`, 'alert');
    if (state === 'countdown' && wrong >= MAX_WRONG) {
      log('Too many wrong attempts: the SOS is sent straight away.', 'alert');
      sendSos();
      return false;
    }
    const wrongText = el.screen.querySelector('[data-wrong]');
    if (wrongText) wrongText.textContent = `Wrong password ${wrong} of ${MAX_WRONG}`;
    return true;
  }

  // ---------- Alarm flow ----------

  function trigger(why) {
    if (state !== 'idle') return;
    clearTimeout(laterTimer);
    state = 'countdown';
    reason = why;
    wrong = 0;
    delivered = false;
    secondsLeft = WINDOW_SEC;
    siren(true);
    log(`${why}. The 130 dB siren starts.`, 'alert');

    if (el.nearby.checked) {
      log('The app pops up the SOS screen. You have 10 seconds to cancel with your password.');
      renderCountdown();
    } else {
      log('Your phone isn’t nearby, so nobody can cancel. The SOS goes out in 10 seconds.');
      renderHome();
    }

    countdownTimer = setInterval(() => {
      secondsLeft -= 1;
      el.hint.textContent = `Sending SOS in ${secondsLeft}s`;
      updateCountdown();
      if (secondsLeft <= 0) sendSos();
    }, 1000);
    el.hint.textContent = `Sending SOS in ${secondsLeft}s`;
  }

  function deliver() {
    delivered = true;
    el.device.classList.remove('beacon-on');
    log('SOS sent: Mom, Riya and the control room get your live location every 15 seconds.', 'alert');
    showSms(`🚨 Priya needs help! Live location: ${MAP_LINK}`);
    renderActive();
  }

  function sendSos() {
    clearInterval(countdownTimer);
    state = 'active';
    el.hint.textContent = 'SOS active: only the app password stops it';
    if (el.nearby.checked) {
      deliver();
    } else {
      el.device.classList.add('beacon-on');
      log('Beacon mode: the keychain broadcasts an SOS. Nearby Safety Pear users would relay it with their location.', 'alert');
      log('Turn “Phone nearby” back on to see what happens when your phone returns.');
      renderHome();
    }
  }

  function stopAlarm() {
    clearInterval(countdownTimer);
    siren(false);
    el.device.classList.remove('beacon-on');
    state = 'idle';
    el.hint.textContent = 'Hold the button for 2 seconds';
  }

  function onNearbyChange() {
    const nearby = el.nearby.checked;
    if (state === 'idle' || state === 'silent') {
      log(nearby ? 'Phone back in range: connected over Bluetooth.' : 'Phone out of range: the keychain still works on its own.');
      if (state === 'idle') renderHome();
    } else if (state === 'countdown') {
      if (nearby) {
        log('Phone back in range: the SOS screen pops up again.');
        renderCountdown();
      } else {
        log('Phone out of range: the cancel option is gone.');
        renderHome();
      }
    } else if (state === 'active') {
      if (nearby && !delivered) {
        log('Phone back in range: the SOS is delivered through the app straight away.', 'good');
        deliver();
      } else if (nearby) {
        renderActive();
      } else {
        el.device.classList.add('beacon-on');
        log('Phone out of range: the keychain switches to beacon mode.');
        renderHome();
      }
    }
  }

  function reset() {
    clearInterval(countdownTimer);
    clearTimeout(laterTimer);
    stopAlarm();
    el.timeline.innerHTML = '';
    el.contactView.hidden = true;
    log('Ready. Hold the pink button on the keychain for 2 seconds.');
    renderHome();
  }

  // ---------- Inputs ----------

  const startHold = (e) => {
    e.preventDefault();
    if (holdTimer || state !== 'idle') return;
    el.hold.classList.add('holding');
    el.hint.textContent = 'Keep holding…';
    holdTimer = setTimeout(() => {
      holdTimer = null;
      el.hold.classList.remove('holding');
      trigger('Button held for 2 seconds');
    }, HOLD_MS);
  };
  const endHold = () => {
    if (!holdTimer) return;
    clearTimeout(holdTimer);
    holdTimer = null;
    el.hold.classList.remove('holding');
    el.hint.textContent = 'Too short. Hold for the full 2 seconds';
  };
  el.hold.addEventListener('pointerdown', startHold);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.hold.addEventListener(ev, endHold));
  el.hold.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold(e);
  });
  el.hold.addEventListener('keyup', endHold);
  el.hold.addEventListener('contextmenu', (e) => e.preventDefault());

  el.fall.onclick = () => {
    if (state !== 'idle') return;
    el.device.classList.remove('shake');
    void el.device.offsetWidth; // restart the animation
    el.device.classList.add('shake');
    setTimeout(() => trigger('Fall detected by the motion sensor'), 500);
  };

  el.voice.onclick = () => {
    if (state !== 'idle') return;
    if (!el.nearby.checked) {
      log('Voice SOS listens in the app, so it needs your phone nearby.');
      return;
    }
    log('You: “Help me, Pear… help me, Pear.”');
    trigger('Voice trigger: phrase heard twice');
  };

  el.nearby.onchange = onNearbyChange;
  el.sound.onchange = () => sirenSound(state === 'countdown' || state === 'active');
  el.reset.onclick = reset;

  reset();
}
