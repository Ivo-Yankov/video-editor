var mongoose = require("mongoose");

var videoSchema = new mongoose.Schema({
  title: String,
  filename: String,
  tags: [{time: Number, text: String}],
  categories: [String],
  thumbnail: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: mongoose.Schema.Types.Mixed
});

var Video = mongoose.model('videocollection', videoSchema);

videoSchema.methods.getDirPath = function( include_public) {
	// videoSchema.findOne({}).populate('owner').exec(function(err, owner) { 
	// 	console.log(owner);
	// });
	var public_string = "";
	if( include_public ) {
		public_string = 'public/';
	}
	return public_string + "videos/" + this.owner + "/" + this._id + "/";
}

module.exports = mongoose.model('Video', videoSchema);