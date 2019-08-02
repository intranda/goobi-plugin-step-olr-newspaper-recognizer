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

         <div class="box-content" style="background-color:#eee">
         
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
               	
               	<a class="btn btn-primary " onclick={delete_all_issues}>Alle Ausgaben entfernen</a>
				
				<div class="pull-right">
					<!-- Speicher-Button -->
					<a class="btn btn-primary " disabled={!dataDirty} onclick={save_no_mets}>Speichern</a>
					<!-- // Speicher-Button -->
					<a class="btn btn-primary " onclick={save}>METS schreiben</a>
					<!-- // verlassen-Button -->
					<a class="btn btn-primary" onclick={exit}>Plugin verlassen</a>
				</div>
			</div>
		</div>
		<div class="row">
           <div class="col-sm-12">
           		<label class="check-week"><input type="checkbox" class="checkbox-week" checked={biWeekly} onclick={toggleBiWeekly}></input>Zweiwöchentlich</label>
           		<!-- <label class="check-week"><input type="checkbox" class="checkbox-week" checked={monthly} onclick={this.monthly = !this.monthly}></input>Monatlich</label> -->
           </div>
       </div>
	<hr />
	<!-- // Formular für Wochentage -->
	
	
	<!-- Bereich für Ausgaben -->
	<div layout="block" class="col-sm-12">
        <div class="row margin-top-most margin-bottom-most">
		
		<!-- Auflistung aller Ausgaben -->
				<my_row each={page in data} if={page.issue}>
                  	<div  class="row thumbnail-row">
						<div class="col-sm-4">
							
							<div class="col-xs-6 thumbnail-image" style="position: relative;">

								<!-- Bild der Ausgabe -->
								<div class="goobi-thumbnail font-light">
									<div class="goobi-thumbnail-image">
										<div class="thumb">
											<thumbcanvas width={thumb_height} height={thumb_height} image_small={page.image.thumbnailUrl} 
												image_large={page.image.largeThumbnailUrl} 
												title={page.image.tooltip}
												page_id={page.pos}
												preload_large={true}>
											</thumbcanvas>
										</div>
									</div>
								</div>
								<!-- // Bild der Ausgabe -->

								<!-- Button, um diese Ausgabe in vorherige Ausgabe einzugliedern -->
								<a
									onclick="{noIssue}"
									class="btn btn-default fa fa-trash"
									style="position: absolute; right: 10px; bottom: 5px;">
									
								</a>
								<!-- // Button, um diese Ausgabe in vorherige Ausgabe einzugliedern -->
								
							</div>

							<!-- Datum der Ausgabe -->
							<div class="col-xs-5">
								<div class="form-group {page.dateValid ? '' : 'has-error'}">
									<input type="text" value={page.dateStr} onkeyup={changeDate} placeholder="Datum" class="form-control"></input>
									<span if={!page.dateValid} class="help-block">Wrong date format</span>
								</div>
							</div>

							<!-- Button für Datumsgenerierung -->
							<div class="col-xs-1">
								<a onclick={generateDates}
									class="btn btn-default fa fa-play">
								</a>
							</div>
							
							<!-- Nummer der Ausgabe -->
							<div class="col-xs-5 ">
								<div class="form-group">
								<div class="input-group">
									<input type="text" value={page.prefix} onkeyup={changePrefix} placeholder="{msg('prefix')}" class="form-control" style="width:33%"></input>
									<input type="text" value={page.number} onkeyup={changeNumber} placeholder="Nr." class="form-control" style="width:34%"></input>
									<input type="text" value={page.suffix} onkeyup={changeSuffix} placeholder="{msg('suffix')}" class="form-control" style="width:33%"></input>
								</div>
								</div>
							</div>
							<div class="col-xs-1">
								<a class="btn btn-default fa fa-eye" onclick={toggleShowOtherImages}></a>
							</div>
							
							<!-- "Typ" der Ausgabe -->
							<div class="col-xs-5">
								<div class="form-group">
									<select class="form-control" onchange={changeIssueType}>
										<option each={type in issueTypes} selected="{type == page.issueType ? 'selected' : ''}">{type}</option>
									</select>
								</div>
							</div>
							<!-- Button zum Anzeigen oder Ausblenden der zugehörigen Seiten -->
							
							<!-- Details über zugehörige Seiten -->
							<div class="col-xs-6">
								{msg('otherPages')}: {page.otherPages.length}
							</div>
<!-- 							<div class="col-xs-2"></div> -->
							
							
						</div>
						
						<!-- Auflistung aller zugehörigen Seiten der Ausgabe -->
						<div class="other-pages">
							<div class="col-sm-8" if={page.showOtherImages}>
								<div class="newspaper-thumbnails">
									<!-- THUMBNAIL -->
									<div each={otherPage, idx in page.otherPages} class="newspaper-thumbnail">
										<div class="newspaper-thumbnail__image">
											<a onclick={otherOnclick}>
												<thumbcanvas
													width={thumb_height/2} 
													height={thumb_height/2}
													render_text={otherPage.supplement ? otherPage.supplementNo : null}
													render_size="24"
													render_bg_color={otherPage.supplement ? suppl_colors[(otherPage.supplementNo-1)%5] : null}
													image_small={otherPage.image.thumbnailUrl}
													image_large={otherPage.image.largeThumbnailUrl}
													title={otherPage.image.tooltip} page_id={otherPage.pos}
													preload_large={false}>
												</thumbcanvas>
											</a>
										</div>
									</div>
								</div>
                            </div>
                       </div>
                             	
                        </div>
                        <hr style="border-top:1px #bbb solid">
                     </my_row>
                 </div>
             </div>             
         </div>
         
         <hr />
         
         <div class="row">
              <div class="col-sm-12">
               	
				<div class="pull-right">
					<!-- Speicher-Button -->
					<a class="btn btn-primary " disabled={!dataDirty} onclick={save_no_mets}>Speichern</a>
					<!-- // Speicher-Button -->
					<a class="btn btn-primary " onclick={save}>METS schreiben</a>
					<!-- // verlassen-Button -->
					<a class="btn btn-primary" onclick={exit}>Plugin verlassen</a>
				</div>
			</div>
		</div>
    </div>
	<script>
		this.suppl_colors = ["#146abf", "#e00404", "#6300b5", "#ba5d06", "#467021"];
		this.biWeekly = false;
		this.monthly = false;
		this.dataDirty = false;
		this.optsDirty = false;
		this.issueTypes = ["Ausgabe", "Beilage", "Inhaltsverzeichnis", "Leading page"]
		this.lang = opts.lang;
		this.msgs = {};
		this.sent = {};
		this.msg_queue = [];
		this.ws_ready = false;
		if(window.location.protocol == "http:") {
			this.msg_ws = new WebSocket("ws://" + location.host + "/" + location.pathname.split("/")[1] + "/messagesws");
		} else {
		    this.msg_ws = new WebSocket("wss://" + location.host + "/" + location.pathname.split("/")[1] + "/messagesws");
		}
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
		this.save_no_mets_button = opts.saveDataButton;
		this.save_opts_button = opts.saveOptsButton;
		this.finish_button = opts.finishButton;
		this.thumb_height = opts.thumbHeight;
		console.log(opts, this.thumb_height)
		console.log(this.data_el.value);
		this.data = JSON.parse(this.data_el.value);
		for(var i=0;i < this.data.length; i++) {
		    var page = this.data[i];
		    if(page.dateValid === undefined) {
			    page.dateValid = true;
		    }
		    page.pos = i;
		    if(page.issue) {
		        if(!page.issueType) {
		            console.log("issueType not set")
		            page.issueType = "Ausgabe";
		        } else {
		            console.log("issueType:", page.issueType)
		        }
		        var supplCount = 0;
		        for(var k=0;k<page.otherPages.length;k++) {
		            page.otherPages[k].parent = page.pos;
		            page.otherPages[k].pos = i+k+1;
		            if(page.otherPages[k].supplementTitle) {
		                supplCount++;
		            }
		            if(supplCount > 0) {
		                page.otherPages[k].supplementNo = supplCount;
		            }
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
		    console.log("mount bla", this.thumb_height)
// 		    $('.goobi-thumbnail-image .thumb').css('max-height', this.thumb_height + 'px');
//             $('.goobi-thumbnail-image .thumb canvas').css('max-height', this.thumb_height + 'px');
//             $('.goobi-thumbnail-image').css('max-width', (this.thumb_height) + 'px');
		    setInterval(() => {
		        this.save_no_mets();
		    }, 15000);
		})
		
		exit() {
		    this.finish_button.click();
		}
		
		save() {
		    this.data_el.value = this.createSaveData();
		    this.save_button.click();
		    this.dataDirty = false;
		}
		
		save_no_mets() {
		    var saved = false;
		    if(this.dataDirty) {
		        var saveData = this.createSaveData();
			    this.data_el.value = saveData;
			    this.save_no_mets_button.click();
			    console.log("save no mets")
			    this.dataDirty = false;
			    saved = true;
			}
		    if(this.optsDirty) {
		        //TODO:
// 		        this.save_opts_button.click();
		        this.optsDirty = false;
		        saved = true;
		    }
		    if(saved) {
		        this.update();
		    }
		}
		
		createSaveData() {
			var saveData = [];
	        for(var i=0;i<this.data.length;i++) {
	            var page = this.data[i];
	            saveData.push({
	                issue: page.issue,
	                supplementTitle: page.supplementTitle,
	                supplement: page.supplement,
	                dateStr: page.dateStr,
	                prefix: page.prefix,
	                number: page.number,
	                suffix: page.suffix,
	                filename: page.filename,
	                dateValid: page.dateValid,
	                issueType: page.issueType
	            });
	        }
	        return JSON.stringify(saveData);
		}
		
		toggleBiWeekly() {
		    this.biWeekly = !this.biWeekly;
		    console.log(this.biWeekly);
		}
		
		toggleDay(day) {
		    this.optsDirty = true;
		    console.log(day);
		    this[day] = !this[day];
		}
		
		toggleShowOtherImages(e) {
		    e.item.page.showOtherImages = !e.item.page.showOtherImages;
		}
		
		delete_all_issues(e) {
		    this.dataDirty = true;
		    this.data[0].issue = true;
		    this.data[0].otherPages = [];
		    for(var i=1;i<this.data.length;i++) {
		        this.data[i].issue=false;
		        this.data[0].otherPages.push(this.data[i]);
		        this.data[i].parent=0;
		        this.data[i].supplementTitle = false;
		        this.data[i].otherPages = [];
		    }
		}
		
		noIssue(e) {
		    this.dataDirty = true;
		    console.log(e.item.page.pos)
		    var currPage = e.item.page;
		    // find previous and add this and it's other images to it
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
		
		otherOnclick(e) {
		    this.dataDirty = true;
		    var idx = e.item.idx;
		    var page = e.item.otherPage;
		    var origPage = this.data[page.pos];
		    var oldArr = this.data[page.parent].otherPages;
		    if(e.altKey || e.ctrlKey) {
		    	if(!page.supplementTitle) {
		    		//page is not the beginning of a supplement => create new supplement
				    page.supplementTitle = true;
				    origPage.supplementTitle = true;
			        //check if this page already is in another supplement
			        if(origPage.supplement) {
			            //find parent by looking backwards
			            var i = 1;
			            while(idx-i>=0) {
		                    var otherPage = oldArr[idx-i]
			                if(otherPage.supplementTitle) {
			                    var supplementPages = otherPage.supplementPages;
			                    //cut the pages from the old supplement and add them to the new one 
			                    var newSupplementPages = supplementPages.splice(supplementPages.length-i, i);
			                    page.supplementPages = newSupplementPages.splice(1);
			                    break;
			                }
			                i++;
			            }
			        } else {
					    origPage.supplement = true;
					    page.supplement = true;
					    page.supplementPages = [];
					    for(var i=idx+1;i<oldArr.length;i++) {
					        if(oldArr[i].supplement) {
					            break;
					        }
					        oldArr[i].supplement = true;
					        this.data[oldArr[i].pos].supplement = true;
					        page.supplementPages.push(oldArr[i]);
					    }
			        }
		    	} else {
		    		//start page of a supplement has been clicked, remove the supplement
		        	page.supplementTitle = false;
		        	origPage.supplementTitle = false;
		        	page.supplement = false;
		        	origPage.supplement = false;
		        	if(oldArr[idx-1].supplement || oldArr[idx-1].supplementTitle) {
		        		// if there is another supplement preceding this page, it simply becomes part of it.
		        		page.supplement = true
		        		origPage.supplement = true;
		        	} else {
		        		//this is the first or the only supplement in this issue. Remove the supplement status from all children
		        		for(var i=idx+1;i<oldArr.length;i++) {
					        if(oldArr[i].supplementTitle) {
					            break;
					        }
					        oldArr[i].supplement = false;
					        this.data[oldArr[i].pos].supplement = false;
					    }
		        	}
		        }
		    	//re-count all supplement-numbers
		    	var supplCount = 0;
		        for(var i=0;i<oldArr.length;i++) {
		            if(oldArr[i].supplementTitle) {
		                supplCount++;
		            }
		            if(supplCount > 0) {
		            	oldArr[i].supplementNo = supplCount;
		            }
		        }
		    } else {
			    origPage.issue = true;
			    page.issue = true;
			    page.supplementPages = [];
			    var newIssuePages = oldArr.splice(idx, oldArr.length-idx);
			    console.log(newIssuePages)
			    var supplCount = 0;
			    for(var i=1;i<newIssuePages.length;i++) {
			        newIssuePages[i].parent = origPage.pos;
			        newIssuePages[i].pos = origPage.pos+i;
			        newIssuePages[i].supplementPages = [];
			    	origPage.otherPages.push(newIssuePages[i]);
			    	if(newIssuePages[i].supplementTitle) {
			    	    supplCount++;
			    	} 
			    	if(supplCount > 0) {
			    	    newIssuePages[i].supplementNo = supplCount;
			    	}
			    }
		    }
		}
		
		changeDate(e) {
		    this.dataDirty = true;
		    e.item.page.dateStr = e.target.value;
		    e.item.page.dateValid = this.validateDate(e.target.value);
		}
		
		changeIssueType(e) {
		    this.dataDirty = true;
		    e.item.page.issueType = e.target.selectedOptions[0].text;
		}
		
		changeNumber(e) {
		    this.dataDirty = true;
		    e.item.page.number = e.target.value;
		}
		
		changePrefix(e) {
		    this.dataDirty = true;
		    e.item.page.prefix = e.target.value;
		}
		
		changeSuffix(e) {
		    this.dataDirty = true;
		    e.item.page.suffix = e.target.value;
		}
		
		generateDates(e) {
			var dateRegex = /^\d{2}\.\d{2}\.\d{4}$/
		    var startIdx = e.item.page.pos;
	        var startPage = this.data[startIdx];
			if(!startPage.dateStr || !startPage.dateStr.match(dateRegex)) {
				alert("Valid date format is: dd.mm.yyyy");
				return;
			}
		    this.dataDirty = true;
		    var prefix = startPage.prefix;
		    var suffix = startPage.suffix;
	        var startNumber = parseInt(startPage.number);
	        var dateArr = startPage.dateStr.split(".");
	        var startDate = new XDate(parseInt(dateArr[2]), parseInt(dateArr[1]-1), parseInt(dateArr[0]));
	        for (var i = startIdx + 1; i < this.data.length; i++) {
	            var page = this.data[i];
	            if (page.issue) {
	                startNumber++;
	                startDate = this.getNextDate(startDate);
	                page.prefix = prefix;
	                page.suffix = suffix;
	                page.number = "" + startNumber;
	                page.dateStr = startDate.toString("dd.MM.yyyy");
	            }
	        }
	    }

	    getNextDate(currentDate) {
	        var newDate = null;
	        console.log(this.biWeekly);
	        console.log(currentDate.getDay())
	        if(this.biWeekly) {
	            newDate = new XDate(currentDate).addDays(8);
	        } else {
	        	newDate = new XDate(currentDate).addDays(1);
	        }
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
	    
	    validateDate(date) {
			if(date.length == 0) {
			    return true;
			}
	        // check for standard format
	        if(/^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
	            var dateArr = date.split(".");
	            if( !this.checkDate(dateArr[0], dateArr[1], dateArr[2])){
	                return false;
	            }
	            return true;
	        }
	     	// check for month format, e.g.: 01.1870
	        if(/^\d{2}\.\d{4}$/.test(date)) {
	            // check for sanity of month
	            var month = parseInt(date.split(".")[0]);
	        	if(month > 0 && month < 13) {
	        	    return true;
	        	}
	        }
	        // check for issue for two days, e.g.: 14.06.2011/15.06.2011
	        if(/^\d{2}\.\d{2}\.\d{4}\/\d{2}\.\d{2}\.\d{4}$/.test(date)) {
	            // check for sanity of day/month
	            var dates = date.split("/");
	            //check first date
	            var dateArr = dates[0].split(".");
	            if( !this.checkDate(dateArr[0], dateArr[1], dateArr[2])){
	                return false;
	            }
	            dateArr = dates[1].split(".");
	            if( !this.checkDate(dateArr[0], dateArr[1], dateArr[2])){
	                return false;
	            }
	            return true;
	        }
	     // check for multi-month issues, e.g.: 01.1870/03.1870
	        if(/^\d{2}\.\d{4}\/\d{2}\.\d{4}$/.test(date)) {
	        	// check for sanity of months
                var dates = date.split("/");
	        	var month0 = dates[0].split(".")[0];
	        	var month1 = dates[1].split(".")[0];
	        	if(month0>0 && month0<13 && month1>0 && month1<13) {
	        	    return true;
	        	}
	        }
	        // check for two-year issues, e.g.: 1915/1916
	        if(/^\d{4}\/\d{4}$/.test(date)) {
	            return true;
	        }
	        return false;
	    }
	    
	    checkDate(day, month, year) {
	        if(day < 1 || month < 1 || month > 12) {
	            return false;
	        }
	        var dayList = [31,28,31,30,31,30,31,31,30,31,30,31];
	        if(month === 2) {
	            var leapyear = year % 400 == 0 || (year % 100 != 0 && year % 4 == 0);
	            if(leapYear) {
	                return day <= 29;
	            } else {
	                return day <= 28;
	            }
	        } else {
	            return dayList[month-1] >= day;
	        }
	    }
		
	</script>
</newspaper_correction>