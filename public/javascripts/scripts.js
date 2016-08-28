(function ( $ ) {
	$.editor =  {
		pressed_keys: [],
		socket: "",
		timeline: "",
		preview_timeline: "",
		create_selection: false,
		preview_video_interval: "",

		init: function() {

			this.socket = io();
			this.timeline = new $.timeline( $('#timeline'), {
				zoom_button: $('.zoom-button'),
				droppable: true,
				time_marker_start: function(event, ui) {
					var $timeline = $($.editor.timeline.timeline);
					var $time_marker = $timeline.find('.time-marker');
					var video = document.getElementById('preview-final');
					if ( !video.paused && !video.ended ) {
						video.pause();
					}
					$time_marker.stop();
				},
				time_marker_stop: function(event, ui) {
					var $timeline = $($.editor.timeline.timeline);
					var layer_width = Number($timeline.find('.layer').width());
					var end_time = $timeline.attr('data-endtime');
					var position_percent = ui.position.left * 100 / layer_width;
					var video = document.getElementById('preview-final');

					document.getElementById('preview-final').timelineTime = position_percent * end_time / 100;
					$.editor.updateState();
				},
			} );

			this.preview_timeline = $.timeline( $('#preview-area .timeline'), {
				zoom_button: $('.preview-current-zoom-button'),
				time_marker_drag: function(event, ui) {
					var $timeline = $($.editor.preview_timeline.timeline);
					var $time_marker = $timeline.find('.time-marker');
					var layer_width = Number($timeline.find('.layer').width());
					var end_time = $timeline.attr('data-endtime');
					var position_percent = ui.position.left * 100 / layer_width;
					var video = document.getElementById('preview-current');

					video.pause();
					$time_marker.stop();
					document.getElementById('preview-current').currentTime = (position_percent * end_time / 100) + Number($timeline.attr('data-offset'));
				},
			} );

			document.getElementById('preview-current').ontimeupdate = function( e ) {
				if ( this.stream ) {
					var time_delta = (this.currentTime - this.prevTime) || 0;
					this.timelineTime += time_delta;
					$.editor.preview_timeline.stopTimeMarker ( this.timelineTime );
					this.prevTime = this.currentTime;
				}
				else {
					var $timeline = $.editor.preview_timeline.timeline;
					var timeline_offset = Number( $timeline.attr('data-offset') );
					var timeline_end = Number( $timeline.attr('data-duration') ) + timeline_offset;

					if ( timeline_end && this.currentTime > timeline_end ) {
						this.pause();
						this.currentTime = timeline_end;
						$.editor.preview_timeline.stopTimeMarker( this.currentTime );
					}

					if ( timeline_offset && this.currentTime < timeline_offset ) {
						this.currentTime = timeline_offset;
					}
				}
			};

			var final_video = document.getElementById('preview-final');
			final_video.timelineTime = 0;
			final_video.prevTime = 0

			final_video.ontimeupdate = function( e ) {
				var time_delta = (this.currentTime - this.prevTime) || 0;
				this.timelineTime += time_delta;
				$.editor.timeline.stopTimeMarker ( this.timelineTime );
				this.prevTime = this.currentTime;
			};


			$('#preview-current-selection').on('click', function(){
				$.editor.create_selection = true;
			});

			$('#preview-current-remove-selections').on('click', function(){
				$('#preview-current-area .timeline-selection').remove();
			});

			this.preview_timeline.timeline.on('click', function(e){
				if ($.editor.create_selection === true) {
			        var posX = $(this).offset().left;
					var $timeline = $(this);
					var $selection = $('<div class="timeline-selection"></div>');
					
					$timeline.find('.timeline-selection').remove();		
					$selection.css('left', (e.pageX - posX) + "px");
					$selection.resizable({
						handles: "e, w"
					});

					$selection.draggable({
						axis: "x",
						containment: "parent",
						scroll: true
					});

					$timeline.append($selection);
				}
				$.editor.create_selection = false;
			});

			$('#preview-final-play').on('click', function() {
				var video = document.getElementById('preview-final');
				video.play();
				$.editor.timeline.animateTimeMarker();
			});

			$('#preview-final-pause').on('click', function() {
				var video = document.getElementById('preview-final');
				video.pause();
				$.editor.timeline.stopTimeMarker(video.timelineTime);
			});

			$('#preview-final-stop').on('click', function() {
				var video = document.getElementById('preview-final');
				video.timelineTime = 0;
				video.prevTime = 0;
				video.pause();
				$.editor.timeline.stopTimeMarker(video.timelineTime);
				$.editor.updateState();
			});

			$('#preview-current-play').on('click', function() {
				var video = document.getElementById('preview-current');
				video.play();
				$.editor.preview_timeline.animateTimeMarker();
			});

			$('#preview-current-pause').on('click', function() {
				var video = document.getElementById('preview-current');
				video.pause();
				$.editor.preview_timeline.stopTimeMarker(video.currentTime);
			});

			$('#preview-current-stop').on('click', function() {
				var video = document.getElementById('preview-current');
				video.currentTime = 0;
				video.pause();
				$.editor.preview_timeline.stopTimeMarker( 0 );
				if ( video.stream ) {
					video.prevTime = 0;
					video.timelineTime = 0;
					$.editor.updateState();
				}

			});

			$('#remove-selected').on('click', function() {
				$.editor.cropMedia( true );
			});

			$('#remove-unselected').on('click', function() {
				$.editor.cropMedia( false );
			});

			$('#remove-media').on('click', function() {
				$('.layer-media.selected').remove();
				$.editor.updateState();
			});

			$('.set-eq-filter').on('click', function() {
				var $selected_media = $('.layer-media.selected');
				var $this = $(this);
				var filter = $this.attr('data-filter');
				var value = $this.siblings('input').val();
				$.editor.preview_timeline.setTimelineMode( true, document.getElementById('preview-current') );
				$.editor.setFilter( $selected_media, filter, value );
				$.editor.updateState ( $selected_media );
			});

			$('#reverse').on('click', function() {
				var $selected_media = $('.layer-media.selected');
				
				var value = $('#reverse-checkbox').is(':checked');
				$.editor.preview_timeline.setTimelineMode( true, document.getElementById('preview-current') );
				$.editor.setFilter( $selected_media, 'reverse', value );
				$.editor.updateState ( $selected_media );				
			});

			$( ".media" )
			.draggable({ 
				snap: ".layer, .layer:before, .layer-media",
				snapTolerance: 10,
				helper: function() {
					$this = $(this);
					args = {
						background : $this.find('img').attr('src'),
						duration : $this.attr('data-duration'),
						filepath : $this.attr('data-filepath'),
						offset : 0
					}

					return $.editor.createLayerMedia( args );
				},
				stop: function( event, ui ) {
					ui.helper.remove();
				}
			})
			.on('click', function() {
				$('.selected').not(this).removeClass('selected');
				$this = $(this);

				var $preview_area = $('#preview-current-area');
				var $timeline = $preview_area.find('.timeline');


				if ($this.hasClass('selected')) {
					$('#preview-current').attr('src', '');
				}
				else {
					$('#preview-current').attr('src', $this.attr('data-filepath'));
				}
				
				$preview_area.find('button').attr('disabled', 'true');
				$timeline.attr('data-disabled', 'true');
				$timeline.attr('data-duration', '12');
				$timeline.attr('data-endtime', '12');
				$timeline.attr('data-offset', '0');

				$timeline.attr('data-zoom', '1');
				$.editor.preview_timeline.reinit();


				$(this).toggleClass('selected');
			});

			$('#add-layer').on('click', function(){
				$.editor.timeline.addLayer();
			});	

			$('#render').on('click', function(){
				$.editor.renderVideo();
			});

			$('#play').on('click', function(){
				$.editor.renderVideo();
			});	

			this.startHotKeyListener();
		},

		createLayerMedia : function ( args ) {
			var data = "";
			for (var key in args) {
				if (args.hasOwnProperty(key) && key != 'background' && key != 'style') {
					data += "data-" + key + "='" + args[key] + "' ";
				}
			}

			var style = "";
			if ( args.style ) {
				style += args.style;
			}

			if ( args.background ) {
				style += 'background-image:url("' + args.background + '")';
			}

			var $media = $("<div class='layer-media' " + data + " style='" + style + "'></div>");

			return $media;
		},

		mediaOnClickHandler : function( e ){
			$this = $(e.target);
			if( ! $.editor.isKeyPressed('shift') ) {
				$('.selected').not(e.target).removeClass('selected');

				var $preview_area = $('#preview-current-area');
				var $timeline = $preview_area.find('.timeline');

				if ($this.hasClass('selected')) {
					$('#preview-current').attr('src', '');
					$preview_area.find('button').attr('disabled', 'true');
					$timeline.attr('data-disabled', 'true');
					$timeline.attr('data-duration', '12');
					$timeline.attr('data-endtime', '12');
					$timeline.attr('data-offset', '0');
					$(this).removeClass('selected');
				}
				else {
					$('#preview-current').attr('src', $this.attr('data-filepath'));
					$preview_area.find('button').removeAttr('disabled');
					$timeline.attr('data-disabled', 'false');
					$timeline.attr('data-duration', $this.attr('data-duration'));
					$timeline.attr('data-endtime', $this.attr('data-duration'));
					$timeline.attr('data-offset', $this.attr('data-offset'));
					document.getElementById('preview-current').currentTime = $this.attr('data-offset');
					$(this).addClass('selected');

					if ( $this.attr('data-filters') ) {
						$.editor.preview_timeline.setTimelineMode ( true, document.getElementById('preview-current') );
					}
					else {
						$.editor.preview_timeline.setTimelineMode ( false, document.getElementById('preview-current') );	
					}
				}

				$.editor.preview_timeline.reinit();

			}
			
		},

		initLayerMedia : function ( media ) {
			if ( !media ) {
				media = $('.layer-media');
			}

			media.each(function(i,e) {
				$e = $(e);
				var start = Number($e.attr('data-start'));
				var media_duration = Number($e.attr('data-duration'));
				var new_left = ( start / $.editor.timeline.duration * 100 );
				$e.css('left', new_left + "%" );
				$e.css('width', ( media_duration / $.editor.timeline.duration * 100 ) + "%" ); 

				if ($e.attr('data-initiated') !== 'true') {
					$e.on('click', $.editor.mediaOnClickHandler);
					
					$e.draggable({ 
						snap: ".layer, .layer:before, .layer-media",
						snapTolerance: 10,
						stop: function( event, ui ) {
						},
					    start: function(event, ui) {
					        selectedObjs = $('.layer-media.selected');
					    } 
					});
				}

				$e.attr('data-initiated', 'true');
			});
		},

		startHotKeyListener: function( keys ){
			$(document).on('keydown', function(e){
				$.editor.pressed_keys[e.keyCode] = true;
			});

			$(document).on('keyup', function(e){
				$.editor.pressed_keys[e.keyCode] = false;
			});
		},

		isKeyPressed: function( key ) {
			var keys = {
				'control': 17,
				'shift': 16
			}

			return Boolean(this.pressed_keys[keys[key]]);
		},

		getEditorState: function ( single_media ) {
			var timeline_data = [];
			var start;

			if ( !single_media ) {
				var $media = $('#timeline .layer-media');
			}
			else {
				$media = single_media;
			}

			for( var i = 0; i < $media.length; i++) {
				$e = $($media[i]);

				if ( single_media ) {
					start = 0;
				}
				else {
					start = Number($e.attr('data-start'));
				}

				var filters = $e.attr('data-filters');
				if (filters) {
					filters = JSON.parse(filters);
				}

				timeline_data.push({
					'file': $e.attr('data-filepath'),
					'start': start,
					'end': start + Number($e.attr('data-duration')),
					'offset': Number($e.attr('data-offset')),
					'timeline_layer': 0,
					'volume': 1,
					'top_left_x': 0,
					'top_left_y': 0,
					'bottom_right_x': 320,
					'bottom_right_y': 180,
					'has_video': true,
					'has_audio': true,
					'filters' : filters
				});
			}

			return {'clips' : timeline_data};
		},

		renderVideo: function () {
			var timeline_data = [];
			var $media = $('.layer-media');

			$media.each(function(i, e){
				$e = $(e);
				timeline_data.push({
					'file': $e.attr('data-filepath'),
					'start': 0,
					'end': Number($e.attr('data-duration')),
					'timeline_start': Number($e.attr('data-start')),
					'timeline_layer': 0,
					'volume': 1,
					'top_left_x': 0,
					'top_left_y': 0,
					'bottom_right_x': 320,
					'bottom_right_y': 180,
					'has_video': true,
					'has_audio': true
				});
			})
			.promise()
			.done( function(){
				console.log({'clips' : timeline_data});
				$.ajax({
					url: "/editor",
					data: {'clips' : timeline_data},
					method: "post",
					dataType: "json"
				}).done(function( data ) {
					console.log(data);
				});
			});
		},

		updateState: function( single_media ) {
			var state = this.getEditorState( single_media );
			console.log(state);
			this.socket.emit('update_editor_state', state);
			// var video = document.getElementById('preview-final');
			// video.pause();
			// preview_start = document.getElementById('preview-final').timelineTime;
			// video.src = "/preview";
			// if ( preview_start ) {
			// 	video.src += "?preview_start=" + preview_start;
			// }
		},

		cropMedia: function( delete_selected ) {
			var $selected = $('.layer-media.selected');
			var selection_data = $.editor.preview_timeline.getSelectionData();

			if (selection_data.length) {
				// Limit to 1 selection only
				selection_data = selection_data[0];
			}

			var media_duration = Number($selected.attr('data-duration'));

			var media_start = Number($selected.attr('data-start'));
			var media_end = media_start + Number($selected.attr('data-duration'));

			var media_arr = [];

			if ( selection_data.end > media_duration ) {
				selection_data.end = media_duration;
			}

			if ( selection_data.start > media_duration ) {
				selection_data.start = media_duration;
			}

			if ( selection_data.start < 0 ) {
				selection_data.start = 0;
			}

			if ( selection_data.end < 0 ) {
				selection_data.end = 0;
			}

			var media_offset = Number($selected.attr('data-offset'));			

			if ( delete_selected ) {
				if ( selection_data.start > 0 ) {
					media_arr.push(
						$.editor.createLayerMedia({
							style : $selected.attr('style'),
							filepath : $selected.attr('data-filepath'),
							start : media_start,
							offset : media_offset,
							duration : selection_data.start,
						})
					);
				}

				if ( selection_data.end < media_duration ) {
					media_arr.push(
						$.editor.createLayerMedia({
							style : $selected.attr('style'),
							filepath : $selected.attr('data-filepath'),
							start : media_start + selection_data.start,
							duration : media_duration - selection_data.end,
							offset: media_offset + selection_data.end
						})
					);
				}
			}
			else {
				media_arr.push(
					$.editor.createLayerMedia({
						style : $selected.attr('style'),
						filepath : $selected.attr('data-filepath'),
						start : media_start,
						duration : selection_data.end - selection_data.start,
						offset: media_offset + selection_data.start
					})
				);
			}

			var $layer = $selected.closest('.layer');

			if ( media_arr.length ) {

				for ( var i = 0; i < media_arr.length; i++ ) {
					$layer.append(media_arr[i]);
					$.editor.initLayerMedia(media_arr[i]);
				}

				media_arr[0].trigger('click');

				$selected.remove();
			}

			$('#preview-current-area .timeline-selection').remove();
			$.editor.updateState();
		},

		setFilter : function( $media, filter, value ) {
			var filters = $media.attr('data-filters');
			if ( filters ) {
				filters = JSON.parse(filters);
				filters[filter] = value;
			}
			else {
				filters = {};
				filters[filter] = value;
			}
			
			filters = JSON.stringify(filters);

			$media.attr('data-filters', filters);
		}
	}

	$.timeline = function(timeline, args) {

		this.renderRuler = function() {
			var duration_step = this.duration / this.ruler_markers;

			var $ruler = $('<div class="timeline-ruler"></div>');
			var $marker, time, time_string;

			for (var i = 1; i < this.ruler_markers; i++) {
				time = i * duration_step;
				time = time + ""; // Convert to a string
				$marker = $('<div class="ruler-marker"></div>')
				$marker.css('left', (time * 100 / this.duration) + "%");

				if (i % 5 == 0) {
					$marker.addClass('big');
				}

				if (i % ( 5 * this.marker_density ) == 0) {
					$marker.text(time.toHHMMSS());
				}

				$ruler.append($marker);
			}
			return $ruler;
		};

		this.addLayer = function(){
			var layer = $('<div class="layer"></div>');
			this.timeline.append(layer);
			this.renderLayers(layer);
		},

		this.render = function() {
			this.timeline.find('.time-marker').remove();
			var time_marker = this.timeline.find('.time-marker');

			if (!time_marker.length) {
				time_marker = $('<div class="time-marker"><div class="line"></div></div>');
				this.timeline.prepend(time_marker);

				if ( this.timeline.attr('data-disabled') != "true" ) {

					var args = {
						axis: "x",
						containment: "parent",
						scroll: true
					};
					
					if (this.options && this.options.time_marker_drag) {
						args.drag = this.options.time_marker_drag;
					}
					
					if (this.options && this.options.time_marker_start) {
						args.start = this.options.time_marker_start;
					}

					if (this.options && this.options.time_marker_stop) {
						args.stop = this.options.time_marker_stop;
					}


					time_marker.draggable(args);
				}
				else {
					time_marker.css('left', '0');	
				}

			}

			this.renderLayers();
		},

		this.renderLayers = function( layers, droppable ) {
			if ( !layers ) {
				layers = this.timeline.find('.layer');
			}

			if ( this.options && this.options.droppable ) {
				layers.droppable({
					accept: ".layer-media, .media",
					drop: function( event, ui ) {
						$this = $(this);
						var left_px = ui.position.left;				
						var e;

						if ( ui.helper && ui.helper !== ui.draggable ) {
							e = ui.helper.clone();
							$.editor.initLayerMedia(e);

							var offset = $this.offset();
							left_px -= offset.left;
						}
						else {
							e = ui.draggable;
						}
						var left_percent = (left_px * 100) / Number($this.width());
						var new_start = (left_percent / 100) * Number($.editor.timeline.duration);

						e.css('left', left_percent + "%");
						e.attr('data-start', new_start);
						e.css('top', 0).detach().appendTo($this);
						$.editor.updateState();
					}
				});
			}
			
			var tl = this;
			layers.each(function(i,e) {
				$e = $(e);

				// set width
				$e.css('width', tl.layer_width  + "%");

				// render ruler
				$e.find('.timeline-ruler').remove();
				$e.append ( tl.renderRuler() );
			});

			// Process the media elements
			$.editor.initLayerMedia();

		};

		this.reinit = function() {
			this.zoom = timeline.attr('data-zoom') || 1;
			this.marker_density = timeline.attr('data-markerdensity') || 60;
			this.duration = timeline.attr('data-duration') || 600;
			this.layer_width = timeline.attr('data-layerwidth') || 100;
			this.ruler_markers = parseInt(Math.round(this.zoom) * this.layer_width * this.marker_density);
			this.initial_layer_width = this.layer_width;

			this.render();
		};

		this.animateTimeMarker = function() {
			var $timeline = $(this.timeline);
			var $time_marker = $timeline.find('.time-marker');
			var duration = Number( $timeline.attr('data-duration') );
			var end_time = Number( $timeline.attr('data-endtime') );
			var position_left = Number($time_marker.css('left').replace('px', ''));
			var layer_width = Number($timeline.find('.layer').width());
			var current_time = position_left * duration / layer_width;
			var end_position = layer_width * end_time / duration;
			var animation_time = end_time - current_time;

			$time_marker.animate({
				left: end_position + "px"
			}, animation_time * 1000, 'linear');
		};

		this.stopTimeMarker = function( current_time ) {
			var $timeline = $(this.timeline);
			var $time_marker = $timeline.find('.time-marker');
			var offset = Number( $timeline.attr('data-offset') ) || 0;
			current_time -= offset;

			if ( current_time < 0 ) {
				current_time = 0;
			}

			var end_time = Number($timeline.attr('data-endtime')) || 0;
			var duration = Number($timeline.attr('data-duration')) || 1;

			var end_position = Number($timeline.find('.layer').width()) * end_time / duration;	

			var current_time_percent = current_time * 100 / end_time;
			$time_marker.stop().css('left', (current_time_percent * end_position / 100) + "px");
		};

		this.getSelectionData = function() {
			var $timeline = $(this.timeline);
			var $selections = $timeline.find('.timeline-selection');
			var selections_data = [];

			var duration = $timeline.attr('data-duration');
			var layer_width = Number($timeline.find('.layer').width());
			

			for (var i = 0; i < $selections.length; i++ ) {
				$selection = $($selections[i]);
				var left_edge = $selection.position().left;
				var right_edge = left_edge + $selection.width();

				selections_data.push({
					start: left_edge * duration / layer_width,
					end: right_edge * duration / layer_width,
				});
			}

			return selections_data;
		}

		this.setTimelineMode = function ( stream, video ) {
			video.stream = stream;
			video.timelineTime = 0;
			video.currentTime = 0;
			video.prevTime = 0;
			video.pause();
			this.stopTimeMarker( 0 );
			if ( stream ) {
				video.src = "/preview";
			}
		}

		this.timeline = timeline;
		if (!args) {
			args = {};
		}

		this.options = {
			droppable : args.droppable || false,
			time_marker_drag: args.time_marker_drag,
			time_marker_start: args.time_marker_start,
			time_marker_stop: args.time_marker_stop
		}

		this.reinit();

		if (args.zoom_button) {
			var tl = this;
			args.zoom_button.on('click', function(){
				$this = $(this);
				var amount = Number($this.attr('data-amount'));

				var current_zoom = Number(tl.zoom);
				var new_zoom = Math.round((current_zoom + amount) * 100) / 100 ; // Remove inaccuracies from using float numbers
				
				if ( new_zoom > 0.1 && new_zoom < 10 ) {
					tl.zoom = new_zoom;
					tl.layer_width = tl.initial_layer_width * new_zoom;
					tl.render();
				}
			});
		}

		return this;	
	}
}( jQuery ));



$(function(){
	$.editor.init();
});


// Converts a string representing a number of seconds to the format hh:mm:ss
String.prototype.toHHMMSS = function () {
    var sec_num = parseInt(this, 10);
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}