<newspaper_correction>
	<div class="box box-color lightgrey box-bordered">
         <div class="box-title">
             <h3>
                 <i class="fa fa-puzzle-piece"></i>
                 <h:outputText id="id9a" value="#{myPageTitle}" />
             </h3>
             <div class="actions">
                 <a id="id10" onclick={reload} class="btn btn-mini" style="color:white;">
                     <i class="fa fa-refresh" ></i>
                 </a>
             </div>
         </div>

         <div class="box-content">
         
         	<!-- Formular für Wochentage -->
       <div class="row">
               <div class="col-sm-12">
               	<!-- Wochentage als Checkboxen -->
				<label class="check-week"><input type="checkbox" class="checkbox-week" checked={monday} onclick={() => this.toggleDay('monday')}></input>Montag</label>
				<label class="check-week"><input type="checkbox" class="checkbox-week" checked={tuesday} onclick={() => this.toggleDay('tuesday')}></input>Dienstag</label>
				<label class="check-week"><input type="checkbox" class="checkbox-week" checked={wednesday} onclick={() => this.toggleDay('wednesday')}></input>Mittwoch</label>
				<label class="check-week"><input type="checkbox" class="checkbox-week" checked={thursday} onclick={() => this.toggleDay('thursday')}></input>Donnerstag</label>
				<label class="check-week"><input type="checkbox" class="checkbox-week" checked={friday} onclick={() => this.toggleDay('friday')}></input>Freitag</label>
				<label class="check-week"><input type="checkbox" class="checkbox-week" checked={saturday} onclick={() => this.toggleDay('saturday')}></input>Samstag</label>
				<label class="check-week"><input type="checkbox" class="checkbox-week" checked={sunday} onclick={() => this.toggleDay('sunday')}></input>Sonntag</label>
               	<!-- // Wochentage als Checkboxen -->
				
				<!-- Speicher-Button -->
				<a class="btn btn-primary pull-right" onclick={save}>Speichern</a>
				<!-- // Speicher-Button -->
			</div>
	</div>
	<hr />
	<!-- // Formular für Wochentage -->
	
	
	<!-- Bereich für Ausgaben -->
	<div layout="block" class="col-sm-12">
        <div class="row margin-top-most margin-bottom-most">
		
		<!-- Auflistung aller Ausgaben -->
                  	<div each={page in data} if={page.issue} class="row thumbnail-row">
						<div class="col-sm-4">
							
							<div class="col-xs-6 thumbnail-image">

								<!-- Bild der Ausgabe -->
								<div class="goobi-thumbnail font-light">
									<div class="goobi-thumbnail-image">
										<div class="thumb">
											<thumbcanvas width={thumb_height} height={thumb_height} image_small={page.image.thumbnailUrl} 
												image_large={page.image.largeThumbnailUrl} 
												title={page.image.tooltip}>
											</thumbcanvas>
										</div>
									</div>
								</div>
								<!-- // Bild der Ausgabe -->

								<!-- Button, um diese Ausgabe in vorherige Ausgabe einzugliedern -->
								<div class="col-xs-12 text-right">
									<a
										onclick="{noIssue}"
										class="btn btn-default fa fa-trash"
										style="margin-right: 10px; margin-bottom: 5px;">
										
									</a>
								</div>
								<!-- // Button, um diese Ausgabe in vorherige Ausgabe einzugliedern -->
								
							</div>

							<!-- Datum der Ausgabe -->
							<div class="col-xs-4">
								<input type="text" value={page.dateStr} onkeyup={changeDate} placeholder="Datum" class="form-control"></input>
							</div>

							<!-- Button für Datumsgenerierung -->
							<div class="col-xs-2">
								<a onclick={generateDates} 
									class="btn btn-default fa fa-play">
								</a>
							</div>
							
							<!-- Nummer der Ausgabe -->
							<div class="col-xs-4">
								<input type="text" value={page.number} onkeyup={changeNumber} placeholder="Ausgabe" class="form-control"></input>
							</div>
							<!-- Button zum Anzeigen oder Ausblenden der zugehörigen Seiten -->
							<div class="col-xs-2">
								<a class="btn btn-default fa fa-eye" onclick={toggleShowOtherImages}></a>
							</div>
							
							<!-- Details über zugehörige Seiten -->
							<div class="col-xs-4">
								{msg('otherPages')}: {page.otherPages.length}
							</div>
							<div class="col-xs-2"></div>
							
							
						</div>
						
						<!-- Auflistung aller zugehörigen Seiten der Ausgabe -->
						<div id="otherPages">
							<div class="col-sm-8" if={page.showOtherImages}>
                               	<div class="other-images">
                               		<a each={otherPage, idx in page.otherPages} onclick={isIssue}>
                                		<div class="goobi-thumbnail font-light">
		                                    <div class="goobi-thumbnail-image">
		                                        <div class="thumb">
	                                                <thumbcanvas width={thumb_height/2} height={thumb_height/2} image_small={otherPage.image.thumbnailUrl} image_large={otherPage.image.largeThumbnailUrl} title={otherPage.image.tooltip} ></thumbcanvas>
		                                        </div>
		                                    </div>
		                                </div>
	                                </a>
                               	</div>
                              	</div>
                             	</div>
                             	<!-- // Auflistung aller zugehörigen Seiten der Ausgabe -->
                             	
                            <hr />
                        </div>
                     <!-- // Auflistung aller Ausgaben -->
                     
                 </div>
             </div>
             <!-- // Bereich für Ausgaben -->
             
         </div>
    </div>
	<script>
		console.log(opts)
		this.lang = opts.lang;
		this.msgs = {};
		this.sent = {};
		this.msg_queue = [];
		this.ws_ready = false;
		this.msg_ws = new WebSocket("ws://" + location.host + "/" + location.pathname.split("/")[1] + "/messagesws");
		this.msg_ws.onopen = (evt) => {
		    console.log("onopen", this.msg_queue)
		    for(var i=0;i<this.msg_queue.length;i++) {
		        this.msg_ws.send(JSON.stringify({key: this.msg_queue[i], lang: this.lang}));
		    }
		}
		this.msg_ws.onmessage = (msg) => {
		    var message = JSON.parse(msg.data);
		    console.log(message)
		    this.msgs[message.key] = message.value;
		    this.update();
		}
		msg(str) {
		    if(this.msgs[str]) {
		        return this.msgs[str]
		    } else {
		        if(!this.sent[str]) {
		        	this.sent[str] = true;
		            if(this.ws_ready) {
			            this.msg_ws.send(JSON.stringify({key: str, lang: this.lang}));
		            } else {
		                this.msg_queue.push(str);
		            }
		        }
		    }
		    return str;
		}
		this.data_el = opts.data_el;
		this.save_button = opts.saveButton;
		this.thumb_height = opts.thumbHeight;
		console.log(opts, this.thumb_height)
		this.data = JSON.parse(this.data_el.innerHTML);
		for(var i=0;i < this.data.length; i++) {
		    var page = this.data[i];
		    page.pos = i;
		    if(page.issue) {
		        for(var k=0;k<page.otherPages.length;k++) {
		            page.otherPages[k].parent = page.pos;
		            page.otherPages[k].pos = i+k+1;
		        }
		    }
		}
		console.log(this.data);
		this.monday = true;
		this.tuesday = true;
		this.wednesday = true;
		this.thursday = true;
		this.friday = true;
		this.saturday = true;
		this.sunday = true;
		
		this.on("unmount", function() {
		    this.msg_ws.close();
		})
		
		this.on("mount", function() {
		    console.log("mount", this.thumb_height)
// 		    $('.goobi-thumbnail-image .thumb').css('max-height', this.thumb_height + 'px');
//             $('.goobi-thumbnail-image .thumb canvas').css('max-height', this.thumb_height + 'px');
//             $('.goobi-thumbnail-image').css('max-width', (this.thumb_height) + 'px');
		})
		
		save() {
		    this.data_el.innerHTML = JSON.stringify(this.data);
		    this.save_button.click();
		}
		
		toggleDay(day) {
		    console.log(day);
		    this[day] = !this[day];
		}
		
		toggleShowOtherImages(e) {
		    e.item.page.showOtherImages = !e.item.page.showOtherImages;
		}
		
		noIssue(e) {
		    console.log(e.item.page.pos)
		    var currPage = e.item.page;
		    //TODO: find previous and add this and it's other images to it
		    for(var i=currPage.pos-1; i>=0; i--) {
		        if(this.data[i].issue) {
		            this.data[i].otherPages.push(currPage);
		            console.log(currPage.otherPages.length)
		            currPage.parent= i;
		            var length = currPage.otherPages.length
		            var k = 0;
		            for(k;k<length;k++) {
		                currPage.otherPages[k].parent = i;
		                this.data[i].otherPages.push(currPage.otherPages[k]);
		            }
		            break;
		        } 
		    }
		    console.log("done")
		    currPage.otherPages = [];
		    currPage.issue = false;
		}
		
		isIssue(e) {
		    console.log(e)
		    //TODO: cut all pages from parent...
		    var idx = e.item.idx;
		    var page = e.item.otherPage;
		    var origPage = this.data[page.pos];
		    origPage.issue = true;
		    console.log(page.parent)
		    var oldArr = this.data[page.parent].otherPages;
		    page.issue = true;
		    console.log(idx);
		    var newIssuePages = oldArr.splice(idx, oldArr.length-idx);
		    console.log(newIssuePages)
		    for(var i=1;i<newIssuePages.length;i++) {
		        newIssuePages[i].parent = origPage.pos;
		        newIssuePages[i].pos = origPage.pos+i;
		    	origPage.otherPages.push(newIssuePages[i]);
		    }
	        console.log("new issue page in data", origPage)
	        console.log("parent", page.parent);
		}
		
		changeDate(e) {
		    e.item.page.dateStr = e.target.value;
		}
		
		changeNumber(e) {
		    e.item.page.number = e.target.value;
		}
		
		generateDates(e) {
		    var startIdx = e.item.page.pos;
	        var startPage = this.data[startIdx];
	        var startNumber = parseInt(startPage.number);
	        var dateArr = startPage.dateStr.split(".");
	        var startDate = new XDate(parseInt(dateArr[2]), parseInt(dateArr[1]-1), parseInt(dateArr[0]));
	        for (var i = startIdx + 1; i < this.data.length; i++) {
	            var page = this.data[i];
	            if (page.issue) {
	                startNumber++;
	                startDate = this.getNextDate(startDate);
	                page.number = "" + startNumber;
	                page.dateStr = startDate.toString("dd.MM.yyyy");
	            }
	        }
	    }

	    getNextDate(currentDate) {
	        var newDate = new XDate(currentDate).addDays(1);
	        while (true) {
	            var dayOfWeek = newDate.getDay();
	            console.log(dayOfWeek);
	            switch (dayOfWeek) {
	                case 1:
	                    if (this.monday) {
	                        return newDate;
	                    }
	                    break;
	                case 2:
	                    if (this.tuesday) {
	                        return newDate;
	                    }
	                    break;
	                case 3:
	                    if (this.wednesday) {
	                        return newDate;
	                    }
	                    break;
	                case 4:
	                    if (this.thursday) {
	                        return newDate;
	                    }
	                    break;
	                case 5:
	                    if (this.friday) {
	                        return newDate;
	                    }
	                    break;
	                case 6:
	                    if (this.saturday) {
	                        return newDate;
	                    }
	                    break;
	                case 0:
	                    if (this.sunday) {
	                        return newDate;
	                    }
	                    break;
	                default:
	                    break;

	            }
	            newDate.addDays(1);
	        }
	    }
		
	</script>
</newspaper_correction>