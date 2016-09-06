(function ( $ ) {
	$.editor =  {
		pressed_keys: [],
		socket: "",
		timeline: "",
		preview_timeline: "",
		create_selection: false,
		preview_video_interval: "",	
		aspect_ratio : { 
			width: 16,
			height: 9
		},
		progressbar : "",
		duration : 0,

		init: function() {

			this.socket = io();
			this.socket.on('refresh', function() {
				window.location.reload();
			});

			this.socket.on('render-complete', function( data ) {
				window.open(data,'_blank');
			});

			this.socket.on('render-progress', function( data ) {
				// Convert hh:mm:ss to seconds
				var timemark_split = data.timemark.split(':');
				var seconds = (+timemark_split[0]) * 60 * 60 + (+timemark_split[1]) * 60 + (+timemark_split[2]); 
				$.editor.progressbar.progressbar( 'value', seconds * 100 / $.editor.duration  );
			});

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

			$.editor.resizePreviewScreens();

			$('.preview-video-handle').resizable({
				handles: "e, w, n, s, ne, se, nw, sw"
			}).draggable();

			$('#preview-current-selection').on('click', function(){
				$.editor.create_selection = true;
			});

			$('#preview-current-remove-selections').on('click', function(){
				$('#preview-current-area .timeline-selection').remove();
			});

			$('#apply-fitlers').on('click', function(){
				$.editor.applyFilters();
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
				$.editor.cropMedia( 'remove-selected' );
			});

			$('#remove-unselected').on('click', function() {
				$.editor.cropMedia( 'crop' );
			});

			$('#copy-media').on('click', function() {
				$.editor.cropMedia( 'copy' );
			});

			$('#remove-media').on('click', function() {
				$('.layer-media.selected').remove();
				$.editor.updateState();
			});

			$('#add-media').on('click', function() {
				$new_layer = $.editor.timeline.addLayer();

				$new_media = $.editor.createLayerMedia({
					style : '',
					filepath : '',
					start : 0,
					duration : 10,
					offset: 0,
					filters : "",
					type : "blank",
					hasvideo : true,
					hasaudio : false
				})
				
				$new_media.addClass('blank-media');
				$new_layer.append($new_media);
				$.editor.initLayerMedia($new_media);

				$.editor.updateState();
			});

			$('#apply-overlay-position').on('click', function() {
				var $selected_media = $('.layer-media.selected');
				$.editor.applyOverlayPosition( $selected_media );
			});

			$('#reset-overlay-position').on('click', function() {
				var $selected_media = $('.layer-media.selected');
				$.editor.resetOverlayPosition( $selected_media );
			});

			$('#delete-media').on('click', function() {
				var id = $('.media.selected').attr('data-id');
				$.ajax({
					url: "/delete-media",
					data: {
						id: id
					},
					method: "post",
					dataType: "json"
				}).done(function( data ) {
					if (data == 1) {
						$('.media[data-id=' + id + '], .layer-media[data-id=' + id + ']').remove();
					}
				});
				return false;
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
						offset : 0,
						hasvideo : $this.attr('data-hasvideo'),
						hasaudio : $this.attr('data-hasaudio'),
						type : $this.attr('data-type'),
						filters : $this.attr('data-filters'),
					}

					return $.editor.createLayerMedia( args );
				},
				stop: function( event, ui ) {
					ui.helper.remove();
				}
			})
			.on('click', function() {
				$('.selected').not(this).removeClass('selected');

				$(this).toggleClass('selected');
				$.editor.updateInterfaceElements();
			});

			$('#add-layer').on('click', function(){
				$.editor.timeline.addLayer();
			});	

			$('#open-render-dialog').on('click', function(){
				$( "#render-dialog" ).dialog({title: "Опции за рендиране"});
			});

			$('#render').on('click', function(){
				$( "#render-dialog" ).dialog();
				var options = $.editor.renderVideo( {
					quality : $('#render-quality').val(),
					format : $('#render-format').val(),
					resolution : $('#render-resolution').val()
				} );
				$.editor.updateState( options );
				document.getElementById('preview-current').src = "";
				document.getElementById('preview-final').src = "";

				return false;
			});

			$('.slider').each( function(i, e) {
				$e = $(e);
				$e.slider({
					min: Number($e.attr('data-min')),
					max: Number($e.attr('data-max')),
					step: 0.1,
					value: $e.siblings('.slider-input').val(),
					disabled: true,
					slide: function( event, ui ) {
						$(this).siblings('input').val( ui.value  );
					}
				})
			})

			this.progressbar = $( "#render-progress" ).progressbar();

			this.startHotKeyListener();
			$.editor.updateInterfaceElements();

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
			
			$('.selected').not(e.target).removeClass('selected');

			if ($this.hasClass('selected')) {
				$this.removeClass('selected');
			}
			else {
				$this.addClass('selected');
			}

			$.editor.updateInterfaceElements();
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
						snapTolerance: 10
					});

					$e.resizable({
						handles: "e, w",
						stop: function( event, ui ) {
							var $this = $(this);
							var width = $this.width();
							var timeline_duration = Number($.editor.timeline.timeline.attr('data-duration'));
							var timeline_width = $this.closest('.layer').width();

							$this.attr('data-duration', (timeline_duration * width / timeline_width ) );
							$.editor.updateState();
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
				$layers = $('.layer');
				var $media = [];
				for ( var i = $layers.length - 1; i >= 0; i-- ) {
					$layer_media = $($layers[i]).find('.layer-media');
					if ( $layer_media.length ) {
						for ( var j = 0; j < $layer_media.length; j++ ) {
							$media.push( $($layer_media[j]) );
						}
					}
				}
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
				if (filters && filters != 'undefined') {
					filters = JSON.parse(filters);
				}

				var has_video = $e.attr('data-hasvideo');
				var has_audio = $e.attr('data-hasaudio');

				if ( !has_video || has_video == 'false') {
					has_video = false;
				}
				else {
					has_video = true;
				}

				if ( !has_audio || has_audio == 'false') {
					has_audio = false;
				}
				else {
					has_audio = true;
				}

				var top = 0;
				var left = 0;
				var width = 100;
				var height = 100;
				var overlay_filters = $.editor.getFilter( $e, 'overlay' );
				if ( overlay_filters ) {
					left = overlay_filters.left || 0;
					top = overlay_filters.top || 0;
					width = overlay_filters.width || 100;
					height = overlay_filters.height || 100;
				}
				var duration = Number($e.attr('data-duration'));
				var end = start + duration;

				timeline_data.push({
					'file': $e.attr('data-filepath'),
					'start': start,
					'end': end,
					'offset': Number($e.attr('data-offset')),
					'timeline_layer': 0,
					'volume': 1,
					'left': left,
					'top': top,
					'width': width,
					'height': height,
					'hasvideo': has_video,
					'hasaudio': has_audio,
					'filters' : filters
				});

				if ( end > duration ) {
					duration = end;
				}
			}

			$.editor.duration = duration;

			return {'clips' : timeline_data};
		},

		renderVideo: function ( render_options ) {
			$.ajax({
				url: "/editor",
				data: {
					render_options: render_options
				},
				method: "post",
				dataType: "json"
			}).done(function( data ) {
				console.log(data);
			});
		},

		updateState: function( single_media ) {
			var state = this.getEditorState( single_media );
			this.socket.emit('update_editor_state', state);
			if ( ! single_media ) {
				var video = document.getElementById('preview-final');
				video.pause();
				preview_start = video.timelineTime;
				video.src = "/preview";
				if ( preview_start ) {
					video.src += "?preview_start=" + preview_start;
				}
			}
		},

		cropMedia: function( action ) {
			var $selected = $('.layer-media.selected');
			var selection_data = $.editor.preview_timeline.getSelectionData();
			var media_duration = Number($selected.attr('data-duration'));
			var media_start = Number($selected.attr('data-start'));
			var media_end = media_start + Number($selected.attr('data-duration'));

			if (selection_data.length) {
				// Limit to 1 selection only
				selection_data = selection_data[0];
			}
			else {
				selection_data.start = 0;	
				selection_data.end = media_duration;	
			}

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

			var commong_media_args = {
				style : $selected.attr('style'),
				filepath : $selected.attr('data-filepath'),
				filters : $selected.attr('data-filters'),
				hasaudio : $selected.attr('data-hasaudio'),
				hasvideo : $selected.attr('data-hasvideo'),
				type : $selected.attr('data-type'),
			};



			if ( action == 'remove-selected' ) {
				if ( selection_data.start > 0 ) {
					var args = commong_media_args;
					args.start = media_start;
					args.offset = media_offset;
					args.duration = selection_data.start;

					media_arr.push( $.editor.createLayerMedia(args) );
				}

				if ( selection_data.end < media_duration ) {
					var args = commong_media_args;
					args.start = media_start + selection_data.start;
					args.duration = media_duration - selection_data.end;
					args.offset = media_offset + selection_data.end;

					media_arr.push( $.editor.createLayerMedia(args) );
				}
			}
			else if ( action == 'crop' ) {
				var args = commong_media_args;
				args.start = media_start;
				args.duration = selection_data.end - selection_data.start;
				args.offset = media_offset + selection_data.start;

				media_arr.push( $.editor.createLayerMedia(args) );
			}
			else if ( action == 'copy' ) {
				var args = commong_media_args;
				args.start = media_start;
				args.duration = selection_data.end - selection_data.start;
				args.offset = media_offset + selection_data.start;

				media_arr.push( $.editor.createLayerMedia(args) );
			}

			var $layer = $selected.closest('.layer');

			if ( media_arr.length ) {

				for ( var i = 0; i < media_arr.length; i++ ) {
					$layer.append(media_arr[i]);
					$.editor.initLayerMedia(media_arr[i]);
				}

				media_arr[0].trigger('click');

				if ( action != 'copy' ) {
					$selected.remove();
				}
			}

			$('#preview-current-area .timeline-selection').remove();
			$.editor.updateState();
		},

		applyFilters: function () {
			var $selected_media = $('.layer-media.selected');
			if ( $selected_media.length ) {

				var preview_video = document.getElementById('preview-current');
				var filter;
				var value;
				var media_type = $selected_media.attr('data-type');

				if ( media_type != 'audio' ) {
					$.editor.setFilter( $selected_media, 'text', {
						text : $('#media-text').val(),
						fontsize : $('#media-text-size').val() || 24,
						fontcolor_expr : $('#media-text-color').val(),
						y : $('#media-text-top').val(),
						x : $('#media-text-left').val(),
						box : $('#media-text-box').is(':checked'),
						boxcolor : $('#media-text-boxcolor').val()
					});

					var $eq_filters = $('.eq-filter');
					for ( var i = 0; i < $eq_filters.length; i++ ) {
						$eq_filter = $($eq_filters[i]);
						filter = $eq_filter.attr('id');
						value = $eq_filter.val();
						$.editor.setFilter( $selected_media, filter, value );				
					}

				}

				if ( media_type == 'audio' || media_type == 'video' ) {
					
					reverse_value = $('#reverse-checkbox').is(':checked');
					$.editor.setFilter( $selected_media, 'reverse', reverse_value );

					$.editor.setFilter( $selected_media, 'volume', $('#volume').val() );	
				}

				if ( media_type == 'blank' ) {
					var $handle = $('#preview-current').closest('.preview-video-handle');
					var color = $('#media-background-color').val();
					$handle.css('background-color', color );
					$.editor.setFilter( $selected_media, 'background_color', color.replace('#', '') );
				}

				if ( media_type == 'audio' ) {

				}
				
				$.editor.preview_timeline.setTimelineMode( true, preview_video );
				$.editor.updateState( $selected_media );
			}
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
		},

		getFilter : function( $media, filter ) {
			var filters = $media.attr('data-filters');
			if ( filters ) {
				filters = JSON.parse(filters);
				if ( filter ) {
					return filters[filter];
				}
				else {
					return filters;
				}
			}

			return {};
		},

		applyOverlayPosition : function ( $media ) {
			if ( $media ) {
				var $handle = $('#preview-current').closest('.preview-video-handle');
				var $parent = $handle.parent();
				
				var total_width = $parent.width();
				var total_height = $parent.height();

				var width = $handle.width();
				var height = $handle.height();
				var left = $handle.offset().left - $parent.offset().left;
				var top = $handle.offset().top - $parent.offset().top;

				var overlay_filters = $.editor.getFilter( $media, 'overlay' );
				
				if ( !overlay_filters ) {
					overlay_filters = {};
				}

				overlay_filters.width = width * 100 / total_width;
				overlay_filters.height = height * 100 / total_height;
				overlay_filters.left = left * 100 / total_width;
				overlay_filters.top = top * 100 / total_height;

				$.editor.setFilter( $media, 'overlay', overlay_filters );
				$.editor.updateState ( $media );

				$.editor.preview_timeline.setTimelineMode( true, document.getElementById('preview-current') );


				$handle.css({
					'width': '100%',
					'height': '100%',
					'left': 0,
					'top': 0
				});

				$.editor.updateState( $media );
			}				
		},

		resetOverlayPosition : function ( $media ) {
			var $handle = $('#preview-current').closest('.preview-video-handle'),
				width = '100%',
				height = '100%',
				left = 0,
				top = 0;

			if ( $media ) {
				var overlay_filters = $.editor.getFilter( $media, 'overlay' );
				
				overlay_filters.width = width;
				overlay_filters.height = height;
				overlay_filters.left = left;
				overlay_filters.top = top;

				$.editor.setFilter( $media, 'overlay', overlay_filters );
				$.editor.updateState ( $media );
			}				
			
			$handle.css({
				'width': width,
				'height': height,
				'left': left,
				'top': top
			});

		},

		resizePreviewScreens : function() {	
			$('.preview-video-holder').each( function(i, e) {
				$e = $(e);
				var width = $e.width();
				$e.height(width * $.editor.aspect_ratio.height / $.editor.aspect_ratio.width);
			});
		},

		updateInterfaceElements : function() {

			$selected_media = $('.selected');
			var media_type = $selected_media.attr('data-type');
			$('#delete-media').attr('disabled', true);

			var $preview_area = $('#preview-current-area, .filters');
			var $timeline = $preview_area.find('.timeline');

			$('.slider').slider('disable');

			if ( $selected_media.length ) {

				$timeline.attr('data-disabled', false);
				$timeline.attr('data-duration', $selected_media.attr('data-duration'));
				$timeline.attr('data-endtime', $selected_media.attr('data-duration'));
				$timeline.attr('data-offset', $selected_media.attr('data-offset'));

				// Media element from the library is selected
				if ( $selected_media.hasClass('media') ) {
					$('#delete-media').attr('disabled', false);
					$('#preview-current').attr('src', $selected_media.attr('data-filepath'));
					$preview_area.find('button, input, textarea').attr('disabled', true);
					$preview_area.find('.preview-control-button').attr('disabled', false);

					$timeline.attr('data-offset', '0');

					$timeline.attr('data-zoom', '1');					
				}

				// Media element from the timeline is selected
				if ( $selected_media.hasClass('layer-media') ) {

					$('#preview-current-selection, #preview-current-remove-selections, #remove-selected, #remove-unselected, #copy-media').removeAttr('disabled');

					if ( media_type == 'audio' ) {
						var filters_holders = $('.audio-filters');
					}
					else if ( media_type == 'blank' ) {
						var filters_holders = $('.blank-filters');
					}
					else if ( media_type == 'video' ) {
						var filters_holders = $('.video-filters, .audio-filters');
						$('#apply-overlay-position, #reset-overlay-position').removeAttr('disabled');
					}

					var filters = $.editor.getFilter( $selected_media );

					for ( var filter in filters ) {
						if ( filters.hasOwnProperty(filter) ) {
							if (filter == 'text') {
								$('#media-text').val(filters[filter].text);
								$('#media-text-color').val(filters[filter].fontcolor_expr);
								$('#media-text-box').prop('checked', filters[filter].box);
								$('#media-text-boxcolor').val(filters[filter].boxcolor);
								$('#media-text-size').val(filters[filter].fontsize).siblings('.slider').slider( 'option', 'value', filters[filter].fontsize );
								$('#media-text-left').val(filters[filter].x);
								$('#media-text-top').val(filters[filter].y);
							}
							else {
								var input = $('#' + filter).val( filters[filter] );
								var slider = input.siblings('.slider');
								if( slider.length ) {
									slider.slider( 'option', 'value', filters[filter] );
								}
							}
						}
					}
					$preview_area.find('.preview-control-button').attr('disabled', false);
					$('#apply-fitlers').attr('disabled', false);
					filters_holders.find('.slider').slider('enable');
					filters_holders.find('button, input, textarea').attr('disabled', false);

					$('#preview-current').attr('src', $selected_media.attr('data-filepath'));
					$('#preview-final').attr('src', '');

					var is_blank = ( media_type == 'blank' );

					if ( $selected_media.attr('data-filters') || is_blank ) {
						$.editor.preview_timeline.setTimelineMode ( true, document.getElementById('preview-current') );
					}
					else {
						$.editor.preview_timeline.setTimelineMode ( false, document.getElementById('preview-current') );
						document.getElementById('preview-current').currentTime = $selected_media.attr('data-offset') || 0;
					}
				}
			}

			// There is nothing selected
			else {

				$preview_area.find('button, input, textarea').attr('disabled', 'true');

				$('#preview-current').attr('src', '');
				$preview_area.find('button').attr('disabled', 'true');
				$timeline.attr('data-disabled', 'true');
				$timeline.attr('data-duration', '12');
				$timeline.attr('data-endtime', '12');
				$timeline.attr('data-offset', '0');

				$timeline.attr('data-zoom', '1');
			}
			
			$.editor.preview_timeline.reinit();
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
			var $layer = $('<div class="layer"></div>');
			this.timeline.append( $layer );
			this.renderLayers( $layer );
			return $layer;
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