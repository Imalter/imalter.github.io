(function () {
	'use strict';

	/* ---------- Environment ---------- */

	const root = document.documentElement;
	const mqMobile = window.matchMedia('(max-width: 768px)');
	const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');

	const isMobile = () => mqMobile.matches;
	const isReduced = () => mqReduced.matches;

	const EMAILJS_SRC = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';
	const EMAILJS_PUBLIC_KEY = 'UqPbW4cc1IA8O8-gi';
	const DRAFT_KEY = 'pf-join-draft';

	const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
	const lerp = (a, b, t) => a + (b - a) * t;
	// Frame-rate independent smoothing: k is the per-frame factor at 60 fps
	const damp = (k, dt) => 1 - Math.pow(1 - k, dt);
	const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	const escapeHTML = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
	}[ch]));

	const renderTemplate = (template, data) => {
		if (!template) return '';
		return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
			const value = data[key];
			return value === undefined || value === null ? '' : value;
		});
	};

	const htmlToElement = (html) => {
		const wrapper = document.createElement('div');
		wrapper.innerHTML = html.trim();
		return wrapper.firstElementChild;
	};

	/* ---------- Ticker: one rAF loop shared by every animation ---------- */

	const ticker = (() => {
		const tasks = new Set();
		let rafId = 0;
		let last = 0;

		const loop = (now) => {
			const dt = last ? Math.min((now - last) / (1000 / 60), 4) : 1;
			last = now;
			// A task returns false once it has settled
			tasks.forEach((task) => {
				if (task(dt, now) === false) tasks.delete(task);
			});
			if (tasks.size) {
				rafId = requestAnimationFrame(loop);
			} else {
				rafId = 0;
				last = 0;
			}
		};

		return {
			add(task) {
				tasks.add(task);
				if (!rafId) rafId = requestAnimationFrame(loop);
			}
		};
	})();

	const fontsReady = Promise.race([
		document.fonts && document.fonts.load ? document.fonts.load('800 1em Onest') : Promise.resolve(),
		wait(1000)
	]).catch(() => {});

	/* ---------- Split text into letters, keeping the font's kerning ---------- */

	const splitText = (el) => {
		const text = el.textContent.trim().replace(/\s+/g, ' ');
		el.textContent = text;
		const node = el.firstChild;
		if (!node) return [];

		// Where the browser places each glyph with kerning applied
		const range = document.createRange();
		const kerned = [];
		for (let i = 0; i < text.length; i++) {
			range.setStart(node, i);
			range.setEnd(node, i + 1);
			const rect = range.getBoundingClientRect();
			kerned.push({ left: rect.left, top: rect.top });
		}

		const label = document.createElement('span');
		label.className = 'pf-sr';
		label.textContent = text;

		const visual = document.createElement('span');
		visual.setAttribute('aria-hidden', 'true');

		const chars = [];
		let word = null;
		[...text].forEach((ch, i) => {
			if (ch === ' ') {
				word = null;
				visual.append(' ');
				return;
			}
			if (!word) {
				word = document.createElement('span');
				word.className = 'pf-word';
				visual.append(word);
			}
			const outer = document.createElement('span');
			outer.className = 'pf-ch';
			outer.style.setProperty('--i', chars.length);
			const inner = document.createElement('span');
			inner.className = 'pf-ch-in';
			inner.textContent = ch;
			outer.append(inner);
			word.append(outer);
			chars.push({ el: outer, index: i });
		});

		el.textContent = '';
		el.append(label, visual);

		// Separate boxes lose kerning pairs, so nudge each letter back into place
		const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
		chars.forEach(({ el: ch, index }) => {
			const rect = ch.getBoundingClientRect();
			const delta = kerned[index].left - rect.left;
			if (Math.abs(rect.top - kerned[index].top) > 2) return;
			if (Math.abs(delta) > 0.01 && Math.abs(delta) < fontSize * 0.2) {
				ch.style.marginLeft = (delta / fontSize).toFixed(4) + 'em';
			}
		});

		return chars.map(({ el: ch }) => ch.firstChild);
	};

	/* ---------- Jelly letters: the wordmark bulges towards the cursor ---------- */

	const attachJelly = (el, letters) => {
		if (!mqFine.matches || isReduced() || !letters.length) return;

		const springs = letters.map(() => ({ y: 0, v: 0 }));
		let centers = [];
		let pointer = null;

		const measure = () => {
			const box = el.getBoundingClientRect();
			centers = letters.map((letter) => {
				const r = letter.getBoundingClientRect();
				return r.left + r.width / 2 - box.left;
			});
		};

		const tick = (dt) => {
			const box = el.getBoundingClientRect();
			const reach = box.height * 1.4;
			let moving = false;

			springs.forEach((s, i) => {
				let target = 0;
				if (pointer) {
					const dx = pointer.x - (box.left + centers[i]);
					const dy = (pointer.y - (box.top + box.height * 0.55)) * 1.3;
					const pull = clamp(1 - Math.hypot(dx, dy) / reach, 0, 1);
					target = -pull * pull * box.height * 0.16;
				}
				s.v += (target - s.y) * 0.14 * dt;
				s.v *= Math.pow(0.76, dt);
				s.y += s.v * dt;

				// Stretch while rising, squash while landing
				const stretch = clamp(-s.v * 0.011, -0.14, 0.14);
				letters[i].style.transform = `translate3d(0, ${s.y.toFixed(2)}px, 0) scale(${(1 - stretch * 0.55).toFixed(3)}, ${(1 + stretch).toFixed(3)})`;
				if (Math.abs(s.v) > 0.02 || Math.abs(target - s.y) > 0.05) moving = true;
			});

			if (!moving && !pointer) letters.forEach((letter) => { letter.style.transform = ''; });
			return moving;
		};

		el.addEventListener('pointerenter', measure);
		el.addEventListener('pointermove', (e) => {
			if (e.pointerType !== 'mouse') return;
			if (!centers.length) measure();
			pointer = { x: e.clientX, y: e.clientY };
			ticker.add(tick);
		});
		el.addEventListener('pointerleave', () => {
			pointer = null;
			ticker.add(tick);
		});

		// Click sends a wave through the letters
		el.addEventListener('click', () => {
			const height = el.getBoundingClientRect().height;
			springs.forEach((s, i) => {
				setTimeout(() => {
					s.v -= height * 0.06;
					ticker.add(tick);
				}, i * 45);
			});
		});

		window.addEventListener('resize', () => { centers = []; });
	};

	/* ---------- Magnetic buttons ---------- */

	const bindMagnetic = (el) => {
		if (!mqFine.matches || isReduced() || el.dataset.magnetBound) return;
		el.dataset.magnetBound = '1';
		let offset = { x: 0, y: 0 };

		el.addEventListener('pointermove', (e) => {
			const r = el.getBoundingClientRect();
			const cx = r.left - offset.x + r.width / 2;
			const cy = r.top - offset.y + r.height / 2;
			offset = { x: (e.clientX - cx) * 0.22, y: (e.clientY - cy) * 0.3 };
			el.style.translate = `${offset.x.toFixed(1)}px ${offset.y.toFixed(1)}px`;
		});
		el.addEventListener('pointerleave', () => {
			offset = { x: 0, y: 0 };
			el.style.translate = '';
		});
	};

	/* ---------- Horizontal stage: inertial scroll, drag, keys, depth ---------- */

	const scrollContainer = document.getElementById('scroll-container');
	const heroItem = document.querySelector('.pf-item-first');
	const scroller = {
		current: 0,
		target: 0,
		velocity: 0,
		skew: 0,
		max: 0,
		ease: 0.09,
		driving: false,
		tween: null
	};
	let sections = [];

	const collectSections = () => {
		sections = [heroItem, ...document.querySelectorAll('#pf-apps-root .pf-item:not(.pf-placeholder)')]
			.filter(Boolean)
			.map((el) => ({ el, anchor: 0 }));
	};

	const measureStage = () => {
		if (isMobile()) return;
		const viewport = scrollContainer.clientWidth;
		const padStart = parseFloat(getComputedStyle(scrollContainer).paddingLeft) || 0;
		scroller.max = Math.max(0, scrollContainer.scrollWidth - viewport);
		sections.forEach((s) => {
			s.anchor = clamp(s.el.offsetLeft - padStart, 0, scroller.max);
		});
		scroller.target = clamp(scroller.target, 0, scroller.max);
	};

	const renderStage = () => {
		const viewport = scrollContainer.clientWidth || 1;
		const x = scroller.current;
		scrollContainer.style.setProperty('--pf-skew', `${scroller.skew.toFixed(2)}deg`);
		sections.forEach((s) => {
			const d = (s.anchor - x) / viewport;
			// Only items near the viewport need fresh values
			if (Math.abs(d) < 1.6 || s.d === undefined || Math.abs(s.d) < 1.6) {
				s.el.style.setProperty('--d', d.toFixed(4));
			}
			s.d = d;
		});
	};

	const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

	const stageTick = (dt, now) => {
		if (isMobile()) return false;
		const prev = scroller.current;

		if (scroller.tween) {
			const { from, to, start, duration } = scroller.tween;
			const t = clamp((now - start) / duration, 0, 1);
			scroller.current = lerp(from, to, easeInOutCubic(t));
			if (t >= 1) {
				scroller.tween = null;
				scroller.driving = false;
			}
			scrollContainer.scrollLeft = scroller.current;
		} else if (scroller.driving) {
			scroller.current = lerp(scroller.current, scroller.target, damp(scroller.ease, dt));
			if (Math.abs(scroller.target - scroller.current) < 0.5) {
				scroller.current = scroller.target;
				scroller.driving = false;
			}
			scrollContainer.scrollLeft = scroller.current;
		} else {
			// Native scrolling: touch, scrollbar, focus moving into view
			scroller.current = scroller.target = scrollContainer.scrollLeft;
		}

		scroller.velocity = (scroller.current - prev) / dt;
		const skewTarget = isReduced() ? 0 : clamp(scroller.velocity * -0.05, -3, 3);
		scroller.skew = lerp(scroller.skew, skewTarget, damp(0.16, dt));
		if (Math.abs(scroller.skew) < 0.01) scroller.skew = 0;

		renderStage();
		return scroller.driving || scroller.skew !== 0 || scroller.velocity !== 0;
	};

	const scrollStageTo = (x, { tween = false } = {}) => {
		const to = clamp(x, 0, scroller.max);
		if (isReduced()) {
			scroller.tween = null;
			scroller.driving = false;
			scroller.current = scroller.target = to;
			scrollContainer.scrollLeft = to;
			ticker.add(stageTick);
			return;
		}
		if (tween) {
			const distance = Math.abs(to - scroller.current);
			scroller.tween = { from: scroller.current, to, start: performance.now(), duration: clamp(400 + distance * 0.35, 500, 1400) };
		} else {
			scroller.tween = null;
		}
		scroller.target = to;
		scroller.driving = true;
		ticker.add(stageTick);
	};

	const playheadIndex = () => {
		let best = 0;
		sections.forEach((s, i) => {
			if (Math.abs(s.anchor - scroller.current) < Math.abs(sections[best].anchor - scroller.current)) best = i;
		});
		return best;
	};

	const goToSection = (index) => {
		const s = sections[clamp(index, 0, sections.length - 1)];
		if (!s) return;
		if (isMobile()) {
			s.el.scrollIntoView({ behavior: isReduced() ? 'auto' : 'smooth', block: 'start' });
		} else {
			scrollStageTo(s.anchor, { tween: true });
		}
	};

	const isModalOpen = () => root.classList.contains('pf-modal-open');

	window.addEventListener('wheel', (e) => {
		if (isMobile() || e.ctrlKey || isModalOpen()) return;
		e.preventDefault();
		const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? scrollContainer.clientWidth : 1;
		// Trackpad swipes map 1:1, mouse wheels scroll a bit further per notch
		const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY * 1.5;
		scroller.ease = 0.09;
		scroller.tween = null;
		scrollStageTo(scroller.target + delta * unit);
	}, { passive: false });

	scrollContainer.addEventListener('scroll', () => {
		if (!scroller.driving) ticker.add(stageTick);
	}, { passive: true });

	/* Drag-to-scroll with momentum (pointer API) */
	(function () {
		const interactiveSelector = 'a, button, input, textarea, select, label, [data-no-drag]';
		let pointerId = null;
		let isDown = false;
		let isDragging = false;
		let startX = 0;
		let startY = 0;
		let startScroll = 0;
		let lastX = 0;
		let lastTime = 0;
		let velocity = 0;

		scrollContainer.addEventListener('pointerdown', (e) => {
			if (e.button !== 0 || e.pointerType !== 'mouse' || isMobile()) return;
			if (e.target.closest(interactiveSelector)) return;
			isDown = true;
			isDragging = false;
			pointerId = e.pointerId;
			startX = lastX = e.clientX;
			startY = e.clientY;
			startScroll = scroller.target;
			lastTime = performance.now();
			velocity = 0;
		});

		window.addEventListener('pointermove', (e) => {
			if (!isDown || e.pointerId !== pointerId) return;
			const dx = e.clientX - startX;

			if (!isDragging) {
				if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - startY)) return;
				isDragging = true;
				root.classList.add('pf-dragging');
				try { scrollContainer.setPointerCapture(pointerId); } catch (err) {}
			}

			const now = performance.now();
			const frameVelocity = ((e.clientX - lastX) / Math.max(1, now - lastTime)) * (1000 / 60);
			velocity = lerp(velocity, frameVelocity, 0.4);
			lastX = e.clientX;
			lastTime = now;

			scroller.ease = 0.35;
			scroller.tween = null;
			scrollStageTo(startScroll - dx);
		});

		const endPointer = (e) => {
			if (!isDown || (e && e.pointerId !== pointerId)) return;
			isDown = false;

			if (isDragging) {
				// Throw: keep gliding in the direction of the release
				scroller.ease = 0.06;
				if (performance.now() - lastTime < 80) scrollStageTo(scroller.target - velocity * 20);

				const preventClick = (ev) => {
					ev.stopImmediatePropagation();
					ev.preventDefault();
				};
				window.addEventListener('click', preventClick, { capture: true, once: true });
				setTimeout(() => window.removeEventListener('click', preventClick, true), 0);
			}

			isDragging = false;
			root.classList.remove('pf-dragging');
			try { scrollContainer.releasePointerCapture(pointerId); } catch (err) {}
			pointerId = null;
		};

		window.addEventListener('pointerup', endPointer);
		window.addEventListener('pointercancel', endPointer);
	})();

	window.addEventListener('keydown', (e) => {
		if (isMobile() || isModalOpen() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
		if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;

		const current = playheadIndex();
		let next = null;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
			case 'PageDown':
				next = current + 1;
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
			case 'PageUp':
				next = current - 1;
				break;
			case ' ':
				if (e.target.closest && e.target.closest('button, a')) return;
				next = current + (e.shiftKey ? -1 : 1);
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = sections.length - 1;
				break;
			default:
				return;
		}
		e.preventDefault();
		goToSection(next);
	});

	const resetStage = () => {
		scroller.tween = null;
		scroller.driving = false;
		scroller.skew = 0;
		scroller.current = scroller.target = isMobile() ? 0 : scrollContainer.scrollLeft;
		scrollContainer.style.removeProperty('--pf-skew');
		sections.forEach((s) => {
			s.el.style.removeProperty('--d');
			s.d = undefined;
		});
		measureStage();
		if (!isMobile()) renderStage();
	};

	let resizeFrame = 0;
	window.addEventListener('resize', () => {
		cancelAnimationFrame(resizeFrame);
		resizeFrame = requestAnimationFrame(() => {
			measureStage();
			if (!isMobile()) {
				scrollContainer.scrollLeft = scroller.current = scroller.target;
				renderStage();
			}
		});
	});

	mqMobile.addEventListener('change', resetStage);

	/* ---------- Reveal on enter ---------- */

	let revealQueue = [];
	const revealObserver = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			revealObserver.unobserve(entry.target);
			if (root.classList.contains('pf-ready')) {
				entry.target.classList.add('is-in');
			} else {
				revealQueue.push(entry.target);
			}
		});
	}, { threshold: 0, rootMargin: '0px -4% -8% 0px' });

	const flushReveals = () => {
		revealQueue.forEach((el, i) => {
			setTimeout(() => el.classList.add('is-in'), isReduced() ? 0 : 200 + i * 160);
		});
		revealQueue = [];
	};

	/* ---------- Videos: load when near, play only while visible ---------- */

	const loadObserver = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			loadObserver.unobserve(entry.target);
			const video = entry.target.querySelector('.pf-app-video');
			if (video && !video.src) {
				video.src = video.dataset.src;
				video.preload = 'auto';
			}
		});
	}, { rootMargin: '50% 50%' });

	const players = new Map();

	const syncPlayer = (player) => {
		const { video, visible, userPaused } = player;
		if (!video) return;
		if (visible && !userPaused && !document.hidden) {
			if (!video.src) video.src = video.dataset.src;
			const attempt = video.play();
			if (attempt) attempt.catch(() => {});
		} else if (!video.paused) {
			video.pause();
		}
	};

	const playObserver = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			const player = players.get(entry.target);
			if (!player) return;
			player.visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
			syncPlayer(player);
		});
	}, { threshold: [0, 0.35, 0.6] });

	document.addEventListener('visibilitychange', () => players.forEach(syncPlayer));

	const wirePlayer = (card) => {
		const screen = card.querySelector('.pf-app-screen');
		const video = card.querySelector('.pf-app-video');
		const toggle = card.querySelector('.pf-app-toggle');
		if (!screen || !video) return;

		const player = { video, visible: false, userPaused: isReduced() };
		players.set(screen, player);

		const setPaused = (paused) => {
			player.userPaused = paused;
			screen.classList.toggle('is-paused', paused);
			if (toggle) toggle.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
			syncPlayer(player);
		};
		setPaused(player.userPaused);

		let flashTimer = 0;
		const flip = () => {
			setPaused(!player.userPaused);
			screen.classList.add('is-flash');
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => screen.classList.remove('is-flash'), 900);
		};

		video.addEventListener('playing', () => video.classList.add('is-ready'));
		screen.addEventListener('click', (e) => {
			if (e.target.closest('.pf-app-toggle')) return;
			flip();
		});
		if (toggle) toggle.addEventListener('click', flip);

		loadObserver.observe(screen);
		playObserver.observe(screen);
	};

	const wireMediaLoaders = (card) => {
		card.querySelectorAll('.pf-media').forEach((media) => {
			const shell = media.closest('.pf-app-screen, .pf-media-shell');
			const skeleton = shell ? shell.querySelector(':scope > .pf-skeleton') : null;
			let revealed = false;
			const reveal = () => {
				if (revealed) return;
				revealed = true;
				media.classList.add('pf-media-loaded');
				if (skeleton) skeleton.remove();
			};
			if (media.complete && media.naturalWidth) {
				reveal();
			} else {
				media.addEventListener('load', reveal, { once: true });
				media.addEventListener('error', reveal, { once: true });
			}
		});
	};

	/* ---------- Tilt: the screen leans towards the cursor, light follows ---------- */

	const enableTilt = mqFine.matches && !isReduced();

	const attachTilt = (card) => {
		if (!enableTilt) return;
		const shell = card.querySelector('.pf-app-screen-root');
		const media = shell ? shell.querySelector('.pf-app-screen') : null;
		if (!shell || !media) return;

		const maxRotateX = 6; // deg
		const maxRotateY = 8; // deg
		const liftPx = 8;
		const current = { rx: 0, ry: 0, lift: 0, mx: 50, my: 0 };
		const target = { rx: 0, ry: 0, lift: 0, mx: 50, my: 0 };
		let hovering = false;

		const tick = (dt) => {
			const k = damp(0.14, dt);
			let moving = false;
			Object.keys(current).forEach((key) => {
				current[key] = lerp(current[key], target[key], k);
				if (Math.abs(current[key] - target[key]) > 0.02) moving = true;
			});

			if (!moving && !hovering) {
				media.style.transform = '';
				shell.classList.remove('pf-tilt-active');
				return false;
			}

			const scale = 1 + current.lift * 0.015;
			media.style.transform = `translateY(${(-current.lift * liftPx).toFixed(2)}px) scale(${scale.toFixed(4)}) rotateX(${current.rx.toFixed(2)}deg) rotateY(${current.ry.toFixed(2)}deg)`;
			media.style.setProperty('--mx', `${current.mx.toFixed(1)}%`);
			media.style.setProperty('--my', `${current.my.toFixed(1)}%`);
			return moving;
		};

		shell.addEventListener('pointermove', (ev) => {
			if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
			if (root.classList.contains('pf-dragging') || !card.classList.contains('is-in')) return;
			const rect = shell.getBoundingClientRect();
			const normX = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
			const normY = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
			target.rx = -(normY * 2 - 1) * maxRotateX;
			target.ry = (normX * 2 - 1) * maxRotateY;
			target.lift = 1;
			target.mx = normX * 100;
			target.my = normY * 100;
			hovering = true;
			shell.classList.add('pf-tilt-active');
			ticker.add(tick);
		});

		const resetTilt = () => {
			hovering = false;
			Object.assign(target, { rx: 0, ry: 0, lift: 0, mx: 50, my: 0 });
			ticker.add(tick);
		};
		shell.addEventListener('pointerleave', resetTilt);
		shell.addEventListener('pointercancel', resetTilt);
	};

	/* ---------- App cards ---------- */

	const appsRoot = document.getElementById('pf-apps-root');
	const PLACEHOLDER_COUNT = 3;
	const templatesData = window.PF_TEMPLATES || null;

	const showPlaceholders = (count = PLACEHOLDER_COUNT) => {
		if (!appsRoot || !templatesData) return;
		const placeholderStores = renderTemplate(templatesData.placeholderStores, {});
		for (let i = 0; i < count; i++) {
			const card = htmlToElement(renderTemplate(templatesData.placeholderCard, { placeholderStores }));
			if (card) appsRoot.appendChild(card);
		}
	};

	const clearPlaceholders = () => {
		if (!appsRoot) return;
		appsRoot.querySelectorAll('.pf-placeholder').forEach((el) => el.remove());
	};

	const renderStores = (app, className) => {
		const stores = app.stores || {};
		if (!stores.ios && !stores.android) return '';
		const title = app.title || 'Game';
		const ios = stores.ios ? renderTemplate(templatesData.storeLink, {
			href: escapeHTML(stores.ios),
			label: escapeHTML(`${title} on the App Store`),
			icon: 'i-apple'
		}) : '';
		const android = stores.android ? renderTemplate(templatesData.storeLink, {
			href: escapeHTML(stores.android),
			label: escapeHTML(`${title} on Google Play`),
			icon: 'i-google-play'
		}) : '';
		return `<div class="${className}">${ios}${android}</div>`;
	};

	const renderMedia = (app, index) => {
		const title = app.title || 'Game';
		const eager = index === 0;
		const posterSrc = app.video ? app.video.poster : app.image;
		const poster = posterSrc ? renderTemplate(templatesData.poster, {
			src: escapeHTML(posterSrc),
			loading: eager ? 'eager' : 'lazy',
			priority: eager ? 'high' : 'auto',
			alt: app.video ? '' : escapeHTML(`${title} preview`)
		}) : '';
		const video = app.video ? renderTemplate(templatesData.video, {
			src: escapeHTML(app.video.src),
			label: escapeHTML(`${title} gameplay`)
		}) : '';
		return poster + video;
	};

	const renderAppCard = (app, index) => {
		if (!templatesData) return '';
		return renderTemplate(templatesData.appCard, {
			index,
			media: renderMedia(app, index),
			toggle: app.video ? templatesData.toggle : '',
			icon: escapeHTML(app.icon || ''),
			title: escapeHTML(app.title || ''),
			iconAlt: escapeHTML(`${app.title || 'App'} icon`),
			description: escapeHTML(app.description || ''),
			storesMobile: renderStores(app, 'pf-mobile'),
			storesDesktop: renderStores(app, 'pf-stores pf-pc')
		});
	};

	async function loadApps() {
		if (!appsRoot) return;
		showPlaceholders();

		const tryFetch = async (url) => {
			const res = await fetch(url, { cache: 'no-cache' });
			if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
			return res.json();
		};

		try {
			let appsData;
			try {
				appsData = await tryFetch('./src/appsData.json');
			} catch (primaryErr) {
				console.warn('Local appsData fetch failed, trying fallback', primaryErr);
				appsData = await tryFetch('https://playfocus.games/src/appsData.json');
			}

			clearPlaceholders();
			const fragment = document.createDocumentFragment();
			const cards = [];
			appsData.forEach((app, index) => {
				const card = htmlToElement(renderAppCard(app, index));
				if (!card) return;
				if (app.video) card.classList.add('pf-has-video');
				wireMediaLoaders(card);
				wirePlayer(card);
				attachTilt(card);
				card.querySelectorAll('[data-magnetic]').forEach(bindMagnetic);
				fragment.appendChild(card);
				cards.push(card);
			});
			appsRoot.appendChild(fragment);

			await fontsReady;
			cards.forEach((card) => {
				const title = card.querySelector('h2');
				if (title) splitText(title);
				revealObserver.observe(card);
			});
			collectSections();
			measureStage();
			if (!isMobile()) renderStage();
		} catch (err) {
			console.error('Failed to load app cards from JSON', err);
			clearPlaceholders();
			showPlaceholders();
		}
	}

	/* ---------- Modals ---------- */

	const openModal = (id) => {
		const dialog = document.getElementById(id);
		if (!dialog || dialog.open) return;
		document.querySelectorAll('.pf-modal[open]').forEach((other) => closeModal(other, { instant: true }));
		dialog.showModal();
		// A tall dialog always opens at its top, wherever it was last scrolled to
		dialog.scrollTop = 0;
		root.classList.add('pf-modal-open');
		dialog.dispatchEvent(new CustomEvent('pf:open'));
	};

	const closeModal = (dialog, { instant = false } = {}) => {
		if (!dialog || !dialog.open || dialog.classList.contains('is-closing')) return;

		const finish = () => {
			dialog.classList.remove('is-closing');
			dialog.close();
		};

		if (instant || isReduced()) {
			finish();
			return;
		}
		dialog.classList.add('is-closing');
		setTimeout(finish, 280);
	};

	document.querySelectorAll('.pf-modal').forEach((dialog) => {
		let pressedOnBackdrop = false;

		dialog.addEventListener('pointerdown', (e) => { pressedOnBackdrop = e.target === dialog; });
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog && pressedOnBackdrop) closeModal(dialog);
		});
		dialog.addEventListener('cancel', (e) => {
			e.preventDefault();
			closeModal(dialog);
		});
		dialog.addEventListener('close', () => {
			if (!document.querySelector('.pf-modal[open]')) root.classList.remove('pf-modal-open');
			dialog.dispatchEvent(new CustomEvent('pf:closed'));
		});
		dialog.querySelectorAll('[data-modal-close]').forEach((btn) => {
			btn.addEventListener('click', () => closeModal(dialog));
		});
	});

	document.addEventListener('click', (e) => {
		const opener = e.target.closest('[data-modal-open]');
		if (!opener) return;
		e.preventDefault();
		openModal(opener.dataset.modalOpen);
	});

	/* ---------- Join Us ---------- */

	let emailjsPromise = null;
	const loadEmailJS = () => {
		if (window.emailjs) return Promise.resolve(window.emailjs);
		if (emailjsPromise) return emailjsPromise;
		emailjsPromise = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = EMAILJS_SRC;
			script.async = true;
			script.onload = () => {
				if (!window.emailjs) {
					reject(new Error('EmailJS did not initialise'));
					return;
				}
				window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
				resolve(window.emailjs);
			};
			script.onerror = () => {
				emailjsPromise = null;
				reject(new Error('EmailJS failed to load'));
			};
			document.head.appendChild(script);
		});
		return emailjsPromise;
	};

	const confetti = (canvas) => {
		if (!canvas) return { burst() {} };
		const ctx = canvas.getContext('2d');
		const colors = ['#00388D', '#0048F0', '#5B8CFF', '#FFC83D', '#7DBB2A', '#F2A65A', '#FF6B8B'];
		let pieces = [];

		const resize = () => {
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = window.innerWidth * ratio;
			canvas.height = window.innerHeight * ratio;
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		};

		const tick = (dt) => {
			ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
			pieces = pieces.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
			pieces.forEach((p) => {
				p.vx *= Math.pow(0.986, dt);
				p.vy = p.vy * Math.pow(0.986, dt) + 0.3 * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.rotation += p.spin * dt;
				p.flip += p.flipSpeed * dt;
				p.life -= dt;

				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rotation);
				ctx.scale(1, Math.cos(p.flip));
				ctx.globalAlpha = clamp(p.life / 40, 0, 1);
				ctx.fillStyle = p.color;
				if (p.round) {
					ctx.beginPath();
					ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
					ctx.fill();
				} else {
					ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
				}
				ctx.restore();
			});
			return pieces.length > 0;
		};

		return {
			burst(x, y) {
				if (isReduced()) return;
				resize();
				for (let i = 0; i < 150; i++) {
					const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
					const speed = 7 + Math.random() * 13;
					pieces.push({
						x,
						y,
						vx: Math.cos(angle) * speed,
						vy: Math.sin(angle) * speed,
						rotation: Math.random() * Math.PI * 2,
						spin: (Math.random() - 0.5) * 0.35,
						flip: Math.random() * Math.PI * 2,
						flipSpeed: 0.08 + Math.random() * 0.2,
						size: 7 + Math.random() * 7,
						color: colors[i % colors.length],
						round: Math.random() < 0.3,
						life: 150 + Math.random() * 60
					});
				}
				ticker.add(tick);
			}
		};
	};

	(function () {
		const dialog = document.getElementById('modalJoinUs');
		const form = document.getElementById('joinUsForm');
		if (!dialog || !form) return;

		const content = dialog.querySelector('.pf-modal-content');
		const submitButton = form.querySelector('[type="submit"]');
		const inputs = [...form.querySelectorAll('.pf-field-input')];
		const message = form.querySelector('textarea');
		const views = {};
		dialog.querySelectorAll('[data-view]').forEach((view) => { views[view.dataset.view] = view; });
		const party = confetti(dialog.querySelector('.pf-confetti'));
		let currentView = 'form';
		let submitted = false;

		const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

		const isFieldValid = (input) => {
			const value = input.value.trim();
			if (!value) return false;
			if (input.type === 'email') return EMAIL_PATTERN.test(value);
			return input.checkValidity();
		};

		const validateField = (input, showError) => {
			const field = input.closest('.pf-field');
			const valid = isFieldValid(input);
			field.classList.toggle('is-valid', valid);
			if (showError || valid) {
				field.classList.toggle('is-invalid', !valid);
				input.setAttribute('aria-invalid', String(!valid));
			}
			return valid;
		};

		const shake = (field) => {
			field.classList.remove('is-shaking');
			void field.offsetWidth;
			field.classList.add('is-shaking');
		};

		const autogrow = () => {
			if (!message) return;
			message.style.height = 'auto';
			message.style.height = `${message.scrollHeight + 3}px`;
		};

		/* Drafts survive an accidental close or reload */
		const saveDraft = () => {
			try {
				const draft = {};
				inputs.forEach((input) => { draft[input.name] = input.value; });
				localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
			} catch (err) {}
		};

		const restoreDraft = () => {
			try {
				const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
				if (!draft) return;
				inputs.forEach((input) => {
					if (!input.value && draft[input.name]) {
						input.value = draft[input.name];
						validateField(input, false);
					}
				});
			} catch (err) {}
		};

		const clearDraft = () => {
			try { localStorage.removeItem(DRAFT_KEY); } catch (err) {}
		};

		inputs.forEach((input) => {
			input.addEventListener('input', () => {
				const field = input.closest('.pf-field');
				validateField(input, field.classList.contains('is-invalid'));
				if (input === message) autogrow();
				saveDraft();
			});
			input.addEventListener('blur', () => {
				validateField(input, submitted || input.value.trim() !== '');
			});
		});

		const showView = (name, { instant = false } = {}) => {
			if (name === currentView || !views[name]) return;
			const from = views[currentView];
			const to = views[name];
			const startHeight = content.offsetHeight;

			from.hidden = true;
			from.classList.remove('is-active');
			to.hidden = false;
			currentView = name;
			content.classList.toggle('is-error', name === 'error');

			if (instant || isReduced()) {
				to.classList.add('is-active');
				return;
			}

			// Morph the sheet's height, then let the new content rise in
			const endHeight = content.offsetHeight;
			content.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
				duration: 650,
				easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
			});
			[...to.children].forEach((child, i) => {
				child.animate([
					{ opacity: 0, transform: 'translate3d(0, 18px, 0)' },
					{ opacity: 1, transform: 'none' }
				], { duration: 700, delay: 120 + i * 70, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
			});
			requestAnimationFrame(() => to.classList.add('is-active'));

			const heading = to.querySelector('[tabindex="-1"]');
			if (heading) heading.focus({ preventScroll: true });
		};

		views.form.classList.add('is-active');

		dialog.querySelectorAll('[data-view-go]').forEach((btn) => {
			btn.addEventListener('click', () => {
				showView(btn.dataset.viewGo);
				const firstInvalid = inputs.find((input) => !isFieldValid(input));
				setTimeout(() => (firstInvalid || submitButton).focus({ preventScroll: true }), 200);
			});
		});

		dialog.addEventListener('pf:open', () => {
			loadEmailJS().catch(() => {});
			restoreDraft();
			autogrow();
			// Avoid popping the keyboard over the sheet on touch devices
			if (mqFine.matches) setTimeout(() => inputs[0].focus({ preventScroll: true }), 120);
		});

		dialog.addEventListener('pf:closed', () => {
			if (currentView !== 'form') showView('form', { instant: true });
		});

		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			submitted = true;

			const invalid = inputs.filter((input) => !validateField(input, true));
			if (invalid.length) {
				invalid.forEach((input, i) => setTimeout(() => shake(input.closest('.pf-field')), i * 70));
				invalid[0].focus();
				return;
			}

			submitButton.disabled = true;
			submitButton.classList.add('is-loading');

			try {
				const emailjs = await loadEmailJS();
				// Keep the spinner up long enough to read as a deliberate step
				await Promise.all([emailjs.sendForm('service_p1xjiqm', 'join_us', form), wait(700)]);
				console.log('Join Us mail - success');
				form.reset();
				submitted = false;
				inputs.forEach((input) => {
					input.closest('.pf-field').classList.remove('is-valid', 'is-invalid');
					input.removeAttribute('aria-invalid');
				});
				autogrow();
				clearDraft();
				showView('success');
				const check = views.success.querySelector('.pf-state-check');
				setTimeout(() => {
					const r = check.getBoundingClientRect();
					party.burst(r.left + r.width / 2, r.top + r.height / 2);
				}, 450);
			} catch (error) {
				console.log('Join Us mail - error', error);
				showView('error');
			} finally {
				submitButton.disabled = false;
				submitButton.classList.remove('is-loading');
			}
		});
	})();

	/* ---------- Intro ---------- */

	document.querySelectorAll('[data-magnetic]').forEach(bindMagnetic);
	collectSections();
	measureStage();

	fontsReady.then(() => {
		document.querySelectorAll('[data-jelly]').forEach((el) => {
			attachJelly(el, splitText(el));
		});
		requestAnimationFrame(() => {
			root.classList.add('pf-ready');
			flushReveals();
		});
	});

	loadApps();
})();
