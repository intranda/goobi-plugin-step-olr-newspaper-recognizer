<thumbcanvas>
	<div ref="observable">
		<canvas class="thumb-canvas" ref="canvas" onmousemove={mousemove} onmouseout={mouseout}></canvas>
	</div>
	<script>
	
	this.on("mount", () => {
	    this.mouseover = false;
	    this.image_small_url = opts.image_small;
	    this.image_large_url = opts.image_large;
	    this.image_small = null;
	    this.image_large = null;
	    this.height = opts.height;
	    this.width = opts.width;
	    this.render_text = opts.render_text;
	    this.render_pos = opts.render_pos;
	    this.render_size = parseInt(opts.render_size);
	    this.render_bg_color = opts.render_bg_color;
	    this.page_id = opts.page_id;
	    this.canvas = this.refs.canvas;
	    this.update();
	    
	    console.log(opts.loadallimages)
	    if(typeof opts.loadallimages != 'undefined') {
		    if(opts.loadallimages) {
		    	this.drawOnCanvas();
		    } else {
		    	this.createObserver()
		    }
	    }
	})
	
	createObserver() {
   		var observer;
   		var options = {
   		    rootMargin: "100px 0px 1000px 0px",
   		 	threshold: 0.9,
   		    threshold: 1
   		};
   		
   		observer = new IntersectionObserver(this.drawFirst, options);
   		observer.observe(this.refs.observable);
   	}
	
	drawFirst(entries, observer) {
	    entries.forEach(entry => {
		    if(entry.isIntersecting && !this.intersected) {
			    console.log("draw on canvas intersect: " + this.image_small_url)
		    	this.intersected = true;
			    this.drawOnCanvas();
			    if(this.opts.preload_large) {
			        var img = new Image();
			        img.onload = function() {
			            this.image_large = img;
			        }.bind(this);
			        img.src = this.image_large_url;
			    }
		    }
	    })
	}
	
	drawOnCanvas() {
        if ( this.canvas == null ) {
            return;
        }
        var ctx = this.canvas.getContext( '2d' );
        var img = new Image();
        img.onload = () => {
	        this.small_image = img;
            var scale = this.width / img.width;
            if(scale*img.height > this.height) {
                scale = this.height / img.height;
            }
            this.canvas.width = img.width*scale;
            this.canvas.height = img.height*scale;
            ctx.drawImage( img, 0, 0, img.width*scale, img.height*scale );
            if(this.render_text) {
                var centerX = this.canvas.width - (this.render_size/1.5)-2;
                var centerY = this.canvas.height - ((this.render_size)/1.5)-2
                var radius = this.render_size /2 + 4;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
                ctx.fillStyle= this.render_bg_color;
                ctx.fill();
                ctx.fillStyle= 'white';
                var x = this.canvas.width - (this.render_size);
                var y = this.canvas.height - (this.render_size-13);
                ctx.font = "bold " + this.render_size + "px arial";
                ctx.fillText(this.render_text, x, y, this.render_size/2);
            }
        };
        // console.log(image);
        img.src = this.image_small_url;
	}
	
	this.on("update", () => {
	    if(this.render_text != this.opts.render_text) {
		    this.render_text = this.opts.render_text;
		    this.render_pos = this.opts.render_pos;
		    this.render_size = parseInt(this.opts.render_size);
		    this.render_bg_color = this.opts.render_bg_color;
		    if(this.opts.preload_large) {
		        var img = new Image();
		        img.onload = function() {
		            this.image_large = img;
		        }.bind(this);
		        img.src = this.image_large_url;
		    }
		    if(this.intersected) {
		        console.log("onUpdate: drawOnCanvas")
		    	this.drawOnCanvas();
		    }
	    }
	})

	mouseout( event ) {
	    this.mouseover = false;
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
	    if(!event.shiftKey && !event.getModifierState('CapsLock')) {
	        //console.log("no shift");
	        if(this.mouseover) {
	        	this.mouseover = false;
	        	this.drawOnCanvas()
	        }
	        return;
	    } else {
	        //console.log("shift");
	    }
	    this.mouseover = true;
	    if(this.image_large != null) {
	        this.drawLarge(event);
	    } else {
		    var img = new Image();
		    img.onload = () => {
		        this.image_large = img;
		        this.drawLarge(event);
		    }
	        img.src = this.image_large_url;
	    }
	}
	
	drawLarge(event) {
	   	var img = this.image_large;
	    var canvas = event.currentTarget;
	    var absPos = this.getMousePos( canvas, event );
        var relPos = {x:absPos.x/canvas.offsetWidth, y:absPos.y/canvas.offsetHeight};
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
        if(!this.mouseover) {
            return;
        }
        var ctx = canvas.getContext( '2d' );
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
	}
	</script>
</thumbcanvas>