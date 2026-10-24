// Templates catalog
window.PF_TEMPLATES = {
	placeholderStores: `
		<div class="pf-skeleton pf-skeleton-chip"></div>
		<div class="pf-skeleton pf-skeleton-chip"></div>
	`,
	placeholderCard: `
		<div class="pf-item pf-placeholder" aria-hidden="true">
			<div class="pf-app-screen-root pf-media-shell">
				<div class="pf-skeleton"></div>
			</div>
			<div class="pf-app-description">
				<div class="pf-app-icon-root">
					<div class="pf-app-icon-shell pf-media-shell">
						<div class="pf-skeleton"></div>
					</div>
					<div class="pf-mobile">
						{{placeholderStores}}
					</div>
				</div>
				<div class="pf-app-text">
					<div class="pf-skeleton-lines">
						<div class="pf-skeleton pf-skeleton-text" style="width: 70%;"></div>
						<div class="pf-skeleton pf-skeleton-text"></div>
						<div class="pf-skeleton pf-skeleton-text pf-skeleton-text-sm"></div>
					</div>
					<div class="pf-stores pf-pc">
						{{placeholderStores}}
					</div>
				</div>
			</div>
		</div>
	`,
	appCard: `
		<article class="pf-item" aria-labelledby="pf-app-{{index}}-title">
			<div class="pf-app-screen-root pf-media-shell">
				<div class="pf-app-screen">
					<div class="pf-skeleton"></div>
					{{media}}
					<span class="pf-app-sheen" aria-hidden="true"></span>
					{{toggle}}
				</div>
			</div>
			<div class="pf-app-description">
				<div class="pf-app-icon-root">
					<div class="pf-app-icon-shell pf-media-shell">
						<div class="pf-skeleton"></div>
						<img src="{{icon}}" class="pf-app-icon pf-media" width="512" height="512" loading="lazy" decoding="async" alt="{{iconAlt}}">
					</div>
					{{storesMobile}}
				</div>
				<div class="pf-app-text">
					<div>
						<h2 id="pf-app-{{index}}-title">{{title}}</h2>
						<p>{{description}}</p>
					</div>
					{{storesDesktop}}
				</div>
			</div>
		</article>
	`,
	poster: `<img src="{{src}}" class="pf-app-poster pf-media" width="720" height="1280" loading="{{loading}}" fetchpriority="{{priority}}" decoding="async" alt="{{alt}}">`,
	video: `<video class="pf-app-video" data-src="{{src}}" muted loop playsinline preload="none" aria-label="{{label}}"></video>`,
	toggle: `
		<button type="button" class="pf-app-toggle" aria-label="Pause video">
			<svg class="pf-icon pf-icon-pause" aria-hidden="true"><use href="#i-pause"></use></svg>
			<svg class="pf-icon pf-icon-play" aria-hidden="true"><use href="#i-play"></use></svg>
		</button>
	`,
	storeLink: `<a class="pf-store-link" href="{{href}}" target="_blank" rel="noopener" aria-label="{{label}}" data-magnetic><svg class="pf-icon" aria-hidden="true"><use href="#{{icon}}"></use></svg></a>`
};
