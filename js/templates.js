// Templates catalog
window.PF_TEMPLATES = {
	placeholderStores: `
		<div class="pf-skeleton pf-skeleton-chip"></div>
		<div class="pf-skeleton pf-skeleton-chip"></div>
	`,
	placeholderCard: `
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
						{{placeholderStores}}
					</div>
				</div>
				<div class="flex-grow-1 d-flex flex-column justify-content-between">
					<div class="d-flex flex-column gap-2">
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
		<div class="pf-item d-flex">
			<div class="pf-app-screen-root pf-shadow pf-media-shell rounded-5">
				<div class="pf-skeleton"></div>
				{{media}}
			</div>
			<div class="pf-app-description d-flex gap-3">
				<div class="pf-app-icon-root d-flex flex-column gap-3">
					<div class="pf-app-icon-shell pf-media-shell rounded-5 flex-shrink-0">
						<div class="pf-skeleton"></div>
						<img src="{{icon}}" class="pf-app-icon rounded-5 pf-media" loading="lazy" alt="{{iconAlt}}" />
					</div>
					{{storesMobile}}
				</div>
				<div class="flex-grow-1 d-flex flex-column justify-content-between">
					<div>
						<h2>{{title}}</h2>
						<p>{{description}}</p>
					</div>
					{{storesDesktop}}
				</div>
			</div>
		</div>
	`
};
