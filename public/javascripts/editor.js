window.onmousemove = function(e){
	window.mouse_x = e.pageX;
	window.mouse_y = e.pageY;
}

function getScope(ctrlName) {
    var sel = 'div[ng-controller="' + ctrlName + '"]';
    return angular.element(sel).scope();
}

function scrollTimelineRow(e){
	var event = window.drag_event;

	$timeline = $(event.target).parent();
	$timeline_row = $timeline.closest('.col');
	$this = $(e);
	var leftScroll = $timeline_row.scrollLeft();
	var leftPosition = parseInt($this.css('left'));

	$parent_offset = $timeline_row.offset();

	var mouse_x = window.mouse_x - $parent_offset.left;
	var mouse_y = window.mouse_y - $parent_offset.top;

	if (mouse_x > $timeline.width() - 30) {
	  $timeline.width($timeline.width() + 1000);
	}

	if (mouse_x > $timeline_row.width() - 20) {
		$this.css('left', (leftPosition + 20) + 'px');
		$timeline_row.scrollLeft(leftScroll + 20);
	}

	if (mouse_x <  20 && leftScroll > 20) {
		$this.css('left', (leftPosition - 20) + 'px');
		$timeline_row.scrollLeft(leftScroll - 20);
	}

}

function drawTimeline(e){
	e.find(".time-indicator").remove();
	var width = e.width();

	var current_seconds = 0
	$el = $('<div class="time-indicator"><div class="vert-line"></div><div class="time-text"></div><div class="vert-line"></div></div>');
	for(var i=100; i < width - 100; i += 100){
		current_seconds += window.time_interval;
		$el.clone().appendTo(e).find('.time-text').text(convertIntToHHMMSS(current_seconds));
	}

	e.find('.timeline-media').each(function(i, element){
		$e = $(element);
		var metadata = $e.data('metadata');
		var duration = metadata.format.duration;
		var width = duration * 100 / window.time_interval;
		$e.width(width);
		var left_pos = $e.data('timeline_data').start * 100 / window.time_interval;
		$e.css('left', left_pos + "px");
	});
	
}

function convertIntToHHMMSS(totalSec){
	var hours = parseInt( totalSec / 3600 ) % 24;
	var minutes = parseInt( totalSec / 60 ) % 60;
	var seconds = totalSec % 60;
	return (hours < 10 ? "0" + hours : hours) + ":" + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds  < 10 ? "0" + seconds : seconds);
}

function moveTimelineMarker(){
	if(window.move_timeline_marker){
		var moveAmmount = 10;
		$('#timeline-marker').animate({
			'left': '+=' + moveAmmount
		}, 10, moveTimelineMarker);
	}
	else{
		$('#timeline-marker').stop();
	}
}