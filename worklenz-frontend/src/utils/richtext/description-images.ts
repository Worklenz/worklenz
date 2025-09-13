export function isAttachmentUrl(url: string): boolean {
	try {
		const u = new URL(url);
		return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(u.pathname);
	} catch {
		return false;
	}
}

export function insertImageLink(editor: any, url: string, filename?: string): void {
	const name = filename || url.split('/').pop() || 'image';
	editor.insertContent(`<a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a>`);
}

export function convertAttachmentLinksToImages(html: string): string {
	if (!html) return html;
	const div = document.createElement('div');
	div.innerHTML = html;
	const anchors = Array.from(div.querySelectorAll('a[href]')) as HTMLAnchorElement[];
	anchors.forEach(a => {
		const href = a.getAttribute('href') || '';
		if (isAttachmentUrl(href)) {
			const img = document.createElement('img');
			img.src = href;
			img.alt = a.textContent || 'image';
			a.replaceWith(img);
		}
	});
	return div.innerHTML;
} 