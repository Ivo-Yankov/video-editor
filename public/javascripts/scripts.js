(function ( $ ) {
	$.editor =  {
		timeline : "",
		zoom : "",
		marker_density : "",
		duration : "",
		layer_width : "",
		initial_layer_width : "",
		ruler_markers : "",
		pressed_keys: [],
		socket: "",

		init: function() {

			this.socket = io();
			this.timeline = $('#timeline');
			this.zoom = this.timeline.attr('data-zoom') || 1;
			this.marker_density = this.timeline.attr('data-markerdensity') || 60;
			this.duration = this.timeline.attr('data-duration') || 600;
			this.layer_width = this.timeline.attr('data-layerwidth') || 200;
			this.ruler_markers = parseInt(Math.round(this.zoom) * this.layer_width * this.marker_density);
			this.initial_layer_width = this.layer_width;

			var video = document.getElementById('preview-final');
			var mediaSource = new MediaSource();    
			video.src = window.URL.createObjectURL(mediaSource);

			var queue = [];
			function callback(e){

			    video.pause();
			    mediaSource.addSourceBuffer('video/webm; codecs="vorbis,vp8"');
			    mediaSource.sourceBuffers[0].addEventListener('updateend', onBufferUpdated);
			    var firstChunk = true;
			    ss($.editor.socket).on("preview", function(data) {

			    	// the data here needs to be revised!!!!
			        var uIntArray = new Uint8Array(data);

			        if (firstChunk) {
			            mediaSource.sourceBuffers[0].appendBuffer(uIntArray);
			            firstChunk = false;
			        }

			        queue.push(uIntArray);
			    });

			    var onBufferUpdated = function() {
			        console.log('buffer is updated');
			        if (queue.length) {
			            mediaSource.sourceBuffers[0].appendBuffer(queue.shift());
			        }
			    };

			}

			mediaSource.addEventListener('sourceopen', callback, false);
			mediaSource.addEventListener('webkitsourceopen', callback, false);

			$( ".media" )
			.draggable({ 
				snap: ".layer, .layer:before, .layer-media",
				snapTolerance: 10,
				helper: function() {
					$this = $(this);
					var background = $this.find('img').attr('src');
					var duration = $this.attr('data-duration');
					var filepath = $this.attr('data-filepath');
					return $("<div class='layer-media' data-filepath='" + filepath + "' data-duration='" + duration + "' style='background-image:url(" + background + ")'></div>");
				},
				stop: function( event, ui ) {
					ui.helper.remove();
				}
			})
			.on('click', function() {
				$('.media').not(this).removeClass('selected');
				$this = $(this);

				if ($this.hasClass('selected')) {
					$('#preview-current').attr('src', '');
				}
				else {
					$('#preview-current').attr('src', $this.attr('data-filepath'));
				}
				$(this).toggleClass('selected');
			});

			this.render();

			$('.zoom-button').on('click', function(){
				$this = $(this);
				var amount = Number($this.attr('data-amount'));

				var current_zoom = Number($.editor.zoom);
				var new_zoom = Math.round((current_zoom + amount) * 100) / 100 ; // Remove inaccuracies from using float numbers
				
				if ( new_zoom > 0.1 && new_zoom < 10 ) {
					$.editor.zoom = new_zoom;
					$.editor.layer_width = $.editor.initial_layer_width * new_zoom;
					$.editor.render();
				}
			});	

			$('#add-layer').on('click', function(){
				$.editor.addLayer();
			});	

			$('#render').on('click', function(){
				$.editor.renderVideo();
			});	

			$('#play').on('click', function(){
				$.editor.renderVideo();
			});	



			this.startHotKeyListener();
		},

		render: function() {
			this.renderLayers();
		},

		renderLayers: function( layers ) {
			if ( !layers ) {
				layers = $('.layer');
			}

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
					var new_start = (left_percent / 100) * Number($.editor.duration);

					e.css('left', left_percent + "%");
					e.attr('data-start', new_start);
					e.css('top', 0).detach().appendTo($this);
					$.editor.updateState();
				}
			});
			
			layers.each(function(i,e) {
				$e = $(e);

				// set width
				$e.css('width', $.editor.layer_width  + "%");

				// render ruler
				$e.find('.timeline-ruler').remove();
				$e.append ( $.editor.renderRuler() );
			});

			// Process the media elements
			this.initLayerMedia();

		},

		initLayerMedia : function ( media ) {
			if ( !media ) {
				media = $('.layer-media');
			}

			media.draggable({ 
				snap: ".layer, .layer:before, .layer-media",
				snapTolerance: 10,
				stop: function( event, ui ) {
				},
			    start: function(event, ui) {
			        selectedObjs = $('.layer-media.selected');
			    },
			    drag: function(event, ui) {
			    	/*
					// TODO move selected media items at once

			        var currentLoc = $(this).position();
			        var orig = ui.originalPosition;

			        var offsetLeft = currentLoc.left-orig.left;
			        var offsetTop = currentLoc.top-orig.top;
			        
					selectedObjs.each(function(){
				        $this = $(this);
				        var pos = $this.position();

				        var l = $this.position().clientLeft;
				        var t = $this.position().clientTop;

				        $this.css('left', l+offsetLeft);
				        $this.css('top', t+offsetTop);
				    })
					*/
			    }  
			});
			
			media.each(function(i,e) {
				$e = $(e);
				var start = Number($e.attr('data-start'));
				var media_duration = Number($e.attr('data-duration'));
				var new_left = ( start / $.editor.duration * 100 );
				$e.css('left', new_left + "%" );
				$e.css('width', ( media_duration / $.editor.duration * 100 ) + "%" ); 
			});

			media.on('click', function(e){
				if( ! $.editor.isKeyPressed('shift') ) {
					$('.layer-media.selected').not(this).removeClass('selected');
				}
				$(this).toggleClass('selected');
			});
		},

		renderRuler: function() {
			var duration_step = $.editor.duration / $.editor.ruler_markers;

			var $ruler = $('<div class="timeline-ruler"></div>');
			var $marker, time, time_string;

			for (var i = 1; i < $.editor.ruler_markers; i++) {
				time = i * duration_step;
				time = time + ""; // Convert to a string
				$marker = $('<div class="ruler-marker"></div>')
				$marker.css('left', (time * 100 / $.editor.duration) + "%");

				if (i % 5 == 0) {
					$marker.addClass('big');
				}

				if (i % ( 5 * $.editor.marker_density ) == 0) {
					$marker.text(time.toHHMMSS());
				}

				$ruler.append($marker);
			}
			return $ruler;
		},

		addLayer: function(){
			var layer = $('<div class="layer"></div>');
			this.timeline.append(layer);
			this.renderLayers(layer);
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

		getEditorState: function () {
			var timeline_data = [];
			var $media = $('#timeline .layer-media');

			for( var i = 0; i < $media.length; i++) {
				$e = $($media[i]);
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

		previewVideo : function () {

		},

		updateState: function() {
			var state = this.getEditorState();
			this.socket.emit('update_editor_state', state);
			// $video.attr('src', '/preview');
			document.getElementById('preview-final').play();
		}
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