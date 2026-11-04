// Glass: puts a blurred copy of the current cover art behind the whole UI
// and crossfades it on every song change.
(function glass() {
	if (!window.Spicetify?.Player?.addEventListener || !document.body) {
		setTimeout(glass, 300);
		return;
	}

	const bg = document.createElement("div");
	bg.id = "glass-bg";
	const layers = [document.createElement("div"), document.createElement("div")];
	layers.forEach((l) => {
		l.className = "glass-layer";
		bg.appendChild(l);
	});
	const tint = document.createElement("div");
	tint.className = "glass-tint";
	bg.appendChild(tint);
	document.body.prepend(bg);

	let front = 0;
	let lastUrl = "";

	const toHttps = (uri) => {
		if (!uri) return "";
		if (uri.startsWith("spotify:image:")) return "https://i.scdn.co/image/" + uri.slice("spotify:image:".length);
		return uri;
	};

	// Accent: the cover's most vibrant hue, normalised so it works as a glass tint.
	// Exposed as --glass-accent (colour) and --glass-accent-ink (icon colour on top of it).
	function setAccent(d) {
		const bins = Array.from({ length: 18 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
		let total = 0;
		for (let i = 0; i < d.length; i += 4) {
			const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
			const max = Math.max(r, g, b), min = Math.min(r, g, b);
			const l = (max + min) / 2;
			const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
			const w = s * s * (1 - Math.abs(l - 0.5) * 1.6); // favour saturated mid-tones
			if (w <= 0.02) continue;
			let h = 0;
			if (max === r) h = ((g - b) / (max - min) + 6) % 6;
			else if (max === g) h = (b - r) / (max - min) + 2;
			else h = (r - g) / (max - min) + 4;
			const bin = bins[Math.floor((h / 6) * bins.length) % bins.length];
			bin.w += w;
			bin.r += r * w;
			bin.g += g * w;
			bin.b += b * w;
			total += w;
		}
		const best = bins.reduce((a, c) => (c.w > a.w ? c : a));
		const root = document.documentElement.style;
		// Grey / black-and-white covers: plain frosted white instead of a muddy tint.
		if (total < 3 || best.w < 1) {
			root.setProperty("--glass-accent", "rgb(255, 246, 232)");
			root.setProperty("--glass-accent-ink", "#1a120b");
			return;
		}
		let [h, s, l] = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w);
		s = Math.max(s, 0.5);
		l = Math.min(Math.max(l, 0.5), 0.66);
		const [r, g, b] = hslToRgb(h, s, l);
		root.setProperty("--glass-accent", `rgb(${r}, ${g}, ${b})`);
		const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
		root.setProperty("--glass-accent-ink", y > 0.55 ? "#1a120b" : "#ffffff");
	}

	function rgbToHsl(r, g, b) {
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		const l = (max + min) / 2;
		if (max === min) return [0, 0, l];
		const dd = max - min;
		const s = dd / (1 - Math.abs(2 * l - 1));
		let h;
		if (max === r) h = ((g - b) / dd + 6) % 6;
		else if (max === g) h = (b - r) / dd + 2;
		else h = (r - g) / dd + 4;
		return [h * 60, s, l];
	}

	function hslToRgb(h, s, l) {
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = l - c / 2;
		const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
		return [r, g, b].map((v) => Math.round((v + m) * 255));
	}

	function update() {
		const meta = Spicetify.Player.data?.item?.metadata || {};
		const url = toHttps(meta.image_xlarge_url || meta.image_large_url || meta.image_url);
		if (!url || url === lastUrl) return;
		lastUrl = url;

		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			// Brighter covers get a stronger dim so text keeps its contrast.
			try {
				const c = document.createElement("canvas");
				c.width = c.height = 16;
				const ctx = c.getContext("2d");
				ctx.drawImage(img, 0, 0, 16, 16);
				const d = ctx.getImageData(0, 0, 16, 16).data;
				let sum = 0;
				for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
				const lum = sum / (d.length / 4) / 255; // 0 = black, 1 = white
				document.documentElement.style.setProperty("--glass-dim", lum.toFixed(2));
				setAccent(d);
			} catch (_) {}

			const next = layers[1 - front];
			next.style.backgroundImage = `url("${url}")`;
			next.classList.add("visible");
			layers[front].classList.remove("visible");
			front = 1 - front;
		};
		img.onerror = () => {
			lastUrl = ""; // retry on next tick
		};
		img.src = url;
	}

	Spicetify.Player.addEventListener("songchange", update);
	Spicetify.Player.addEventListener("onplaypause", update);
	// Player data may not be ready at startup; keep checking cheaply.
	setInterval(update, 2000);
	update();
})();
