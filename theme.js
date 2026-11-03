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
