<thumbcanvas>
	<canvas class="thumb-canvas" ref="canvas" onmousemove={mousemove} onmouseout={mouseout}></canvas>
	<script>
	
	this.on("mount", () => {
	    this.image_small_url = opts.image_small;
	    this.image_large_url = opts.image_large;
	    this.height = opts.height;
	    this.width = opts.width;
	    this.canvas = this.refs.canvas;
	    this.drawOnCanvas();
	})
	
	drawOnCanvas() {
	        
        if ( this.canvas == null ) {
            return;
        }
        var ctx = this.canvas.getContext( '2d' );
        
        var img = new Image();
        img.onload = () => {
            var scale = this.width / img.width;
            if(scale*img.height > this.height) {
                scale = this.height / img.height;
            }
            this.canvas.width = img.width*scale;
            this.canvas.height = img.height*scale;
            ctx.drawImage( img, 0, 0, img.width*scale, img.height*scale );
	        this.small_image = img;
        };
        // console.log(image);
        img.src = this.image_small_url;
	}

	mouseout( event ) {
	    this.drawOnCanvas( event.currentTarget );
	}

	getMousePos( canvas, event ) {
	    var rect = canvas.getBoundingClientRect();
	    return {
	        x: event.clientX - rect.left,
	        y: event.clientY - rect.top
	    };
	}

	mousemove( event ) {
	    var canvas = event.currentTarget;
	    img = new Image();
	    img.onload = () => {
	        var absPos = this.getMousePos( canvas, event );
	        var relPos = {x:absPos.x/canvas.width, y:absPos.y/canvas.height};
	        var sourceWidth = this.small_image.naturalWidth;
	        var sourceHeight = this.small_image.naturalHeight;
	        var sourceX = img.naturalWidth*relPos.x - sourceWidth/2;
	        var sourceY = img.naturalHeight*relPos.y - sourceHeight/2;
            if(sourceWidth > img.naturalWidth || sourceX < 0) {
                sourceX = 0;
            } else if(sourceX+sourceWidth > img.naturalWidth) {
                sourceX = img.naturalWidth-sourceWidth;
            }
            if(sourceHeight > img.naturalHeight || sourceY < 0) {
                sourceY = 0;
            } else if(sourceY+sourceHeight > img.naturalHeight) {
                sourceY = img.naturalHeight-sourceHeight;
            }
            var ctx = canvas.getContext( '2d' );
            ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
	        /*this.scaleX = ( img.width ) / this.width;
	        this.scaleY = ( img.height ) / this.height;
	        var pos = this.getMousePos( canvas, event );
	        // TODO: check if mouse is still hovering over canvas
	        var ctx = canvas.getContext( '2d' );
	        ctx.fillStyle = 'white';
	        ctx.fillRect( 0, 0, canvas.width, canvas.height );
	        var posX = pos.x * this.scaleX;
	        var posY = pos.y * this.scaleY;
	        if ( posX < 0 ) {
	            posX = 0;
	        }
	        if ( posY < 0 ) {
	            posY = 0;
	        }
	        if ( img.width - posX < canvas.width ) {
	            posX = img.width - canvas.width;
	        }
	        if ( img.height - posY < canvas.height ) {
	            posY = img.height - canvas.height;
	        }
	        ctx.drawImage( img, -posX, -posY );*/
	    }
        img.src = this.image_large_url;
	}
	</script>
</thumbcanvas>