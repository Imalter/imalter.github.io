function switchModals(hideModalId, showModalId) {
	const hideElement = document.getElementById(hideModalId);
	const showElement = document.getElementById(showModalId);

	const hideModal = bootstrap.Modal.getInstance(hideElement) || new bootstrap.Modal(hideElement);
	const showModal = new bootstrap.Modal(showElement);

	hideElement.addEventListener('hidden.bs.modal', function () {
		showModal.show();
	}, { once: true });

	hideModal.hide();
}

(function() {
	emailjs.init({
	publicKey: "UqPbW4cc1IA8O8-gi",
	});
})();

document.addEventListener('DOMContentLoaded', function () {
	'use strict';

	const forms = document.querySelectorAll('.needs-validation');

	forms.forEach(form => {
		form.addEventListener('submit', event => {
			if (!form.checkValidity()) {
				event.preventDefault();
				event.stopPropagation();
			}

			form.classList.add('was-validated');
		}, false);
	});

	const appsRoot = document.getElementById('pf-apps-root');
	const PLACEHOLDER_COUNT = 3;

	const renderTemplate = (template, data) => {
		if (!template) return '';
		return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
			const value = data[key];
			return value === undefined || value === null ? '' : value;
		});
	};

	const renderPlaceholderStores = (templatesData) => {
		if (!templatesData) return '';
		return renderTemplate(templatesData.placeholderStores, {});
	};

	const renderPlaceholderCard = (templatesData) => {
		if (!templatesData) return '';
		const placeholderStores = renderPlaceholderStores(templatesData);
		return renderTemplate(templatesData.placeholderCard, { placeholderStores });
	};

	const showPlaceholders = (templatesData, count = PLACEHOLDER_COUNT) => {
		if (!appsRoot || !templatesData) return;
		for (let i = 0; i < count; i++) {
			const wrapper = document.createElement('div');
			wrapper.innerHTML = renderPlaceholderCard(templatesData).trim();
			const card = wrapper.firstElementChild;
			if (card) appsRoot.appendChild(card);
		}
	};

	const clearPlaceholders = () => {
		if (!appsRoot) return;
		appsRoot.querySelectorAll('.pf-placeholder').forEach(el => el.remove());
	};

	const renderStores = (stores, className) => {
		if (!stores || (!stores.ios && !stores.android)) return '';
		const ios = stores.ios ? `<a class="pf-store-link" href="${stores.ios}"><i class="bi bi-apple"></i></a>` : '';
		const android = stores.android ? `<a class="pf-store-link" href="${stores.android}"><i class="bi bi-google-play"></i></a>` : '';
		return `<div class="${className}">${ios}${android}</div>`;
	};

	const renderMedia = (app) => {
		if (app.video) {
			const posterAttr = app.video.poster ? ` poster="${app.video.poster}"` : '';
			return `<video autoplay muted loop playsinline preload="metadata" src="${app.video.src}" class="pf-app-screen rounded-5 object-fit-fill pf-media"${posterAttr}></video>`;
		}
		if (app.image) {
			return `<img src="${app.image}" class="pf-app-screen rounded-5 object-fit-fill pf-media" loading="lazy" alt="${app.title || 'App screenshot'}" />`;
		}
		return '';
	};

	const renderAppCard = (app, templatesData) => {
		if (!templatesData) return '';
		return renderTemplate(templatesData.appCard, {
			media: renderMedia(app),
			icon: app.icon || '',
			title: app.title || '',
			iconAlt: app.title || 'App icon',
			description: app.description || '',
			storesMobile: renderStores(app.stores, 'pf-mobile justify-content-center gap-2'),
			storesDesktop: renderStores(app.stores, 'pf-stores pf-pc')
		});
	};

	const wireMediaLoaders = (card) => {
		const mediaShells = card.querySelectorAll('.pf-media-shell');
		mediaShells.forEach((shell) => {
			const media = shell.querySelector('.pf-media');
			const skeleton = shell.querySelector('.pf-skeleton');
			if (!media) return;

			let revealed = false;
			const reveal = () => {
				if (revealed) return;
				revealed = true;
				media.classList.add('pf-media-loaded');
				if (skeleton) skeleton.remove();
			};

			if (media.tagName === 'VIDEO') {
				const posterSrc = media.getAttribute('poster');
				if (posterSrc) {
					const posterImg = new Image();
					posterImg.onload = reveal;
					posterImg.onerror = () => {};
					posterImg.src = posterSrc;
				}

				if (media.readyState >= 2) {
					reveal();
				} else {
					media.addEventListener('loadeddata', reveal, { once: true });
				}
				media.addEventListener('error', reveal, { once: true });
			} else {
				if (media.complete && media.naturalWidth) {
					reveal();
				} else {
					media.addEventListener('load', reveal, { once: true });
					media.addEventListener('error', reveal, { once: true });
				}
			}
		});
	};

	// Enable tilt only for precise hover devices (desktop, pen).
	const enableTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

	// Adds pointer-position-driven 3D tilt to a single app card.
	const attachTilt = (card) => {
		if (!enableTilt) return;
		const shell = card.querySelector('.pf-app-screen-root');
		const media = shell ? shell.querySelector('.pf-app-screen') : null;
		if (!shell || !media) return;

		const maxRotateX = 6; // deg
		const maxRotateY = 8; // deg
		const liftPx = 8;
		const scale = 1.015;
		let rafId = null;
		let lastEvent = null;

		const applyTilt = (ev) => {
			if (!ev) return;
			const rect = shell.getBoundingClientRect();
			const normX = ((ev.clientX - rect.left) / rect.width) * 2 - 1; // -1..1
			const normY = ((ev.clientY - rect.top) / rect.height) * 2 - 1; // -1..1
			const rotateX = -normY * maxRotateX;
			const rotateY = normX * maxRotateY;

			media.style.transform = `translateY(-${liftPx}px) scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
		};

		const scheduleUpdate = (ev) => {
			lastEvent = ev;
			if (rafId) return;
			rafId = requestAnimationFrame(() => {
				rafId = null;
				applyTilt(lastEvent);
			});
		};

		const resetTilt = () => {
			media.style.transform = '';
			shell.classList.remove('pf-tilt-active');
		};

		shell.addEventListener('pointerenter', (ev) => {
			if (ev.pointerType && ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
			shell.classList.add('pf-tilt-active');
			scheduleUpdate(ev);
		});

		shell.addEventListener('pointermove', (ev) => {
			if (ev.pointerType && ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
			scheduleUpdate(ev);
		});

		shell.addEventListener('pointerleave', resetTilt);
		shell.addEventListener('pointercancel', resetTilt);
	};

	async function loadApps() {
		if (!appsRoot) return;
		const templatesData = window.PF_TEMPLATES || null;
		try {
			showPlaceholders(templatesData, PLACEHOLDER_COUNT);

			const tryFetch = async (url) => {
				const res = await fetch(url, { cache: 'no-cache' });
				if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
				return res.json();
			};

			let appsData;
			try {
				appsData = await tryFetch('./src/appsData.json');
			} catch (primaryErr) {
				console.warn('Local appsData fetch failed, trying fallback', primaryErr);
				appsData = await tryFetch('https://playfocus.games/src/appsData.json');
			}

			clearPlaceholders();
			const fragment = document.createDocumentFragment();
			appsData.forEach(app => {
				const wrapper = document.createElement('div');
				wrapper.innerHTML = renderAppCard(app, templatesData).trim();
				const card = wrapper.firstElementChild;
				if (card) {
					if (app.video) card.classList.add('pf-has-video');
					wireMediaLoaders(card);
					attachTilt(card);
					fragment.appendChild(card);
				}
			});
			appsRoot.appendChild(fragment);
		} catch (err) {
			console.error('Failed to load app cards from JSON', err);
			clearPlaceholders();
			showPlaceholders(templatesData, PLACEHOLDER_COUNT);
		}
	}

	loadApps();
	
	const scrollContainer = document.getElementById('scroll-container');

	scrollContainer.addEventListener('wheel', function (event) {
		if (window.innerWidth > 768) {
			event.preventDefault();
			scrollContainer.scrollBy({ 
				left: event.deltaY * 2,
				behavior: 'smooth'
			});
		}
	});
	
	/* Drag-to-scroll (pointer API)	*/
	(function() {
		if (!scrollContainer) return;

		const sc = scrollContainer;
		const interactiveSelector = 'a, button, input, textarea, select, label, video, iframe, [data-no-drag]';
		let isDown = false;
		let startX = 0;
		let startY = 0;
		let startScrollLeft = 0;
		let pointerId = null;
		let isDragging = false;

		const dragEnabled = () => window.innerWidth > 768;

		sc.addEventListener('pointerdown', (e) => {
			if (e.button !== 0) return;
			if (!dragEnabled()) return;
			if (e.target.closest(interactiveSelector)) return;

			isDown = true;
			pointerId = e.pointerId;
			startX = e.clientX;
			startY = e.clientY;
			startScrollLeft = sc.scrollLeft;
			isDragging = false;
			try { sc.setPointerCapture(pointerId); } catch (err) {}
		});

		sc.addEventListener('pointermove', (e) => {
			if (!isDown || e.pointerId !== pointerId) return;

			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			if (!isDragging) {
				if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
					isDragging = true;
					sc.classList.add('dragging');
				} else if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) {
					try { sc.releasePointerCapture(pointerId); } catch (err) {}
					isDown = false;
					return;
				} else {
					return;
				}
			}

			e.preventDefault();
			sc.scrollLeft = startScrollLeft - dx;
		});

		function endPointer(e) {
			if (e && pointerId !== null && e.pointerId !== pointerId) return;

			if (isDragging) {
				const preventClick = (ev) => {
					ev.stopImmediatePropagation();
					ev.preventDefault();
					document.removeEventListener('click', preventClick, true);
				};
				document.addEventListener('click', preventClick, true);
			}

			isDown = false;
			isDragging = false;
			sc.classList.remove('dragging');
			try { if (pointerId !== null) sc.releasePointerCapture(pointerId); } catch (err) {}
			pointerId = null;
		}

		sc.addEventListener('pointerup', endPointer);
		sc.addEventListener('pointercancel', endPointer);
		sc.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				sc.scrollBy({ left: 200, behavior: 'smooth' });
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				sc.scrollBy({ left: -200, behavior: 'smooth' });
			}
		});
	})();
	
	const form = document.getElementById('joinUsForm');
	if (form) {
		const submitButton = form.querySelector('button[type="submit"]');
		
		form.addEventListener('submit', function(event) {
			event.preventDefault();
		
			if (!this.checkValidity()) {
				this.classList.add('was-validated');
				return;
			}
		
			if (submitButton) submitButton.disabled = true;
		
			emailjs.sendForm('service_p1xjiqm', 'join_us', this)
				.then(() => {
					console.log('Join Us mail - success');
					switchModals('modalJoinUs', 'modalSuccess');
					form.reset();
					form.classList.remove('was-validated');
				})
				.catch((error) => {
					console.log('Join Us mail - error', error);
					switchModals('modalJoinUs', 'modalError');
				})
				.finally(() => {
					if (submitButton) submitButton.disabled = false;
				});
		});
	}
});
