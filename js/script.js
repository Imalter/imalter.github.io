// JS extracted from index.html
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

	const renderPlaceholderStores = () => {
		return `
			<div class="pf-skeleton pf-skeleton-chip"></div>
			<div class="pf-skeleton pf-skeleton-chip"></div>
		`;
	};

	const renderPlaceholderCard = () => {
		return `
			<div class="pf-item d-flex pf-placeholder">
				<div class="pf-app-screen-root pf-media-shell rounded-5">
					<div class="pf-skeleton"></div>
				</div>
				<div class="pf-app-description d-flex gap-3">
					<div class="pf-app-icon-root d-flex flex-column gap-3">
						<div class="pf-app-icon-shell pf-media-shell rounded-5">
							<div class="pf-skeleton"></div>
						</div>
						<div class="pf-mobile justify-content-center gap-2">
							${renderPlaceholderStores()}
						</div>
					</div>
					<div class="flex-grow-1 d-flex flex-column justify-content-between">
						<div class="d-flex flex-column gap-2">
							<div class="pf-skeleton pf-skeleton-text" style="width: 70%;"></div>
							<div class="pf-skeleton pf-skeleton-text"></div>
							<div class="pf-skeleton pf-skeleton-text pf-skeleton-text-sm"></div>
						</div>
						<div class="pf-stores pf-pc">
							${renderPlaceholderStores()}
						</div>
					</div>
				</div>
			</div>
		`;
	};

	const showPlaceholders = (count = PLACEHOLDER_COUNT) => {
		if (!appsRoot) return;
		for (let i = 0; i < count; i++) {
			const wrapper = document.createElement('div');
			wrapper.innerHTML = renderPlaceholderCard().trim();
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
			return `<video autoplay muted loop playsinline src="${app.video.src}" class="pf-app-screen rounded-5 object-fit-fill pf-media"${posterAttr}></video>`;
		}
		if (app.image) {
			return `<img src="${app.image}" class="pf-app-screen rounded-5 object-fit-fill pf-media" loading="lazy" alt="${app.title || 'App screenshot'}" />`;
		}
		return '';
	};

	const renderAppCard = (app) => {
		return `
			<div class="pf-item d-flex">
				<div class="pf-app-screen-root pf-shadow pf-media-shell rounded-5">
					<div class="pf-skeleton"></div>
					${renderMedia(app)}
				</div>
				<div class="pf-app-description d-flex gap-3">
					<div class="pf-app-icon-root d-flex flex-column gap-3">
						<div class="pf-app-icon-shell pf-media-shell rounded-5 flex-shrink-0">
							<div class="pf-skeleton"></div>
							<img src="${app.icon}" class="pf-app-icon rounded-5 pf-media" loading="lazy" alt="${app.title || 'App icon'}" />
						</div>
						${renderStores(app.stores, 'pf-mobile justify-content-center gap-2')}
					</div>
					<div class="flex-grow-1 d-flex flex-column justify-content-between">
						<div>
							<h2>${app.title}</h2>
							<p>${app.description}</p>
						</div>
						${renderStores(app.stores, 'pf-stores pf-pc')}
					</div>
				</div>
			</div>
		`;
	};

	const wireMediaLoaders = (card) => {
		const mediaShells = card.querySelectorAll('.pf-media-shell');
		mediaShells.forEach((shell) => {
			const media = shell.querySelector('.pf-media');
			const skeleton = shell.querySelector('.pf-skeleton');
			if (!media) return;

			const reveal = () => {
				media.classList.add('pf-media-loaded');
				if (skeleton) skeleton.remove();
			};

			if (media.tagName === 'VIDEO') {
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

	async function loadApps() {
		if (!appsRoot) return;
		showPlaceholders(PLACEHOLDER_COUNT);
		try {
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
				wrapper.innerHTML = renderAppCard(app).trim();
				const card = wrapper.firstElementChild;
				if (card) {
					wireMediaLoaders(card);
					fragment.appendChild(card);
				}
			});
			appsRoot.appendChild(fragment);
		} catch (err) {
			console.error('Failed to load app cards from JSON', err);
			clearPlaceholders();
			showPlaceholders(PLACEHOLDER_COUNT);
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
