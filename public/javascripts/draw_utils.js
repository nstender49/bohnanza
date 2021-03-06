function drawText(text, x, y, size, align, absolute, scaleWidth, margin, color) {
	var l = new Label(text, size).setPosition(x, y).setAbsolute(absolute).setColor(color).setAlign(align);
	var scaleWidth = absolute ? scaleWidth : scaleWidth * cvW;
	scaleLabelsToWidth([l], scaleWidth, margin);
	l.draw();
}

function drawImage(image, x, y, w, h, center, absolute) {
	new ImageLabel(image).setPosition(x, y).setDims(w, h).setCenter(center).setAbsolute(absolute).draw();
}

function drawRect(color, x, y, w, h, absolute=false, border=undefined) {
	if (!absolute) {
		x = x * cvW + wOff;
		y = y * cvH + hOff;
		w *= cvW;
		h *= cvH;
	}
	if (color) {
		ctx.fillStyle = color;
		ctx.fillRect(x, y, w, h);
	}
	if (border) {
		ctx.lineJoin = "round";
		var cornerRadius = 2 * r;
		ctx.lineWidth = cornerRadius;
	
		ctx.strokeStyle = border;
		ctx.strokeRect(x+(cornerRadius/2), y+(cornerRadius/2), w-cornerRadius, h-cornerRadius);
	}
}

function drawCircle(color, x, y, r) {
	// NOTE: this function only works with absolute coords right now.
	ctx.fillStyle = color;
	ctx.lineWidth = 0.1;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, 2 * Math.PI, false);
	ctx.fill();
	ctx.stroke();
}

function scaleLabelsToWidth(labels, width, margin=0) {
	var totalMargin = margin * (2 + labels.length - 1);
	var totalWidth = totalMargin;
	for (var label of labels) {
		totalWidth += label.dims().width;
	}
	var scale = (width - totalMargin) / totalWidth;
	for (var label of labels) {
		label.size = Math.min(label.size * scale, label.maxSize);
	}
}