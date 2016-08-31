var mongoose = require("mongoose");

var mediaSchema = new mongoose.Schema({
  title: String,
  filename: String,
  filepath: String,
  thumbnail: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: mongoose.Schema.Types.Mixed,
  type: { type: String, enum: ['video', 'audio', 'image'] },
  hasvideo : Boolean,
  hasaudio : Boolean
});

var Media = mongoose.model('mediacollection', mediaSchema);

mediaSchema.methods.getDirPath = function( include_public) {
	var public_string = "";
	if( include_public ) {
		public_string = 'public/';
	}
	return public_string + "media/" + this.owner + "/" + this._id + "/";
}

module.exports = mongoose.model('Media', mediaSchema);