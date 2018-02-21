<thumbcanvas>
	<canvas class="thumb-canvas" ref="canvas" onmousemove={mousemove} onmouseout={mouseout}></canvas>
	<script>
	
	this.on("mount", () => {
	    this.image_small_url = opts.image_small;
	    this.image_large_url = opts.image_large;
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
            var scale = ( this.canvas.width * 2 ) / this.width;
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            ctx.drawImage( img, 0, 0, img.width, img.height );
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
	        x: event.clientX - rect.left - 5,
	        y: event.clientY - rect.top - 5
	    };
	}

	mousemove( event ) {
	    var canvas = event.currentTarget;
	    img = new Image();
	    img.onload = () => {
	        this.scaleX = ( img.width - this.small_image.width ) / this.small_image.width;
	        this.scaleY = ( img.height - this.small_image.height ) / this.small_image.height;
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
	        ctx.drawImage( img, -posX, -posY );
	    }
        img.src = this.image_large_url;
	}
	</script>
</thumbcanvas>