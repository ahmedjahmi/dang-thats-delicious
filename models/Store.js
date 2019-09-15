// mongodb can be used with other languages but for node
// we use the mongoose package to interface with mongodb
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			trim: true,
			required: 'Please enter a store name!'
		},
		slug: String,
		description: {
			type: String,
			trim: true
		},
		tags: [String],
		created: {
			type: Date,
			default: Date.now
		},
		location: {
			type: {
				type: String,
				default: 'Point'
			},
			coordinates: [
				{
					type: Number,
					required: 'You must supply coordinates!'
				}
			],
			address: {
				type: String,
				required: 'You must supply an address!'
			}
		},
		photo: String,
		author: {
			type: mongoose.Schema.ObjectId,
			ref: 'User',
			required: 'You must supply an author'
		}
	},
	{
		toJSON: { virtuals: true },
		toObject: { virtuals: true }
	}
);

// define our indexes
storeSchema.index({
	name: 'text',
	description: 'text'
});

storeSchema.index({
	location: '2dsphere'
});

storeSchema.pre('save', async function(next) {
	if (!this.isModified('name')) {
		next(); // skip it
		return; // kill function here
		// return next(); // cleaner way to write above
	}
	this.slug = slug(this.name);
	// find other stores that have a slug of store, store-1, store-2
	const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
	// this model constructs a store, so to use the store being constructed within
	// this function
	const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
	if (storesWithSlug.length) {
		this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
	}
	next();
	// TODO: make slugs more resiliant so slugs are unique
});

// instead of writing js on frontend to handle complex query
// we use aggregate in mongodb like .find() in js frontend
// mongodb docs: aggregation pipeline operators
// aggregation pipeline is the array [] that gets passed to .aggregate()
storeSchema.statics.getTagsList = function() {
	return this.aggregate([
		{ $unwind: '$tags' },
		{ $group: { _id: '$tags', count: { $sum: 1 } } },
		{ $sort: { count: -1 } }
	]);
};

storeSchema.statics.getTopStores = function() {
	return this.aggregate([
		// Look up stores and populate their reviews
		{
			$lookup: {
				from: 'reviews',
				localField: '_id',
				foreignField: 'store',
				as: 'reviews'
			}
		},
        // filter for only items that have 2 or more reviews
        {
            $match: {
                'reviews.1': {
                    $exists: true
                }
            }
        },
        // add the average reviews field
        {
            // wes used $project, not $addFields in his older version of mongodb
            // with $project, we lose all other fields in the data except _id & averageRating
            // unless explicitly expressed which fields are carried over
            // $addFields, just adds averageRating then carries the other fields over
            $addFields: {
                averageRating: {
                    $avg: '$reviews.rating'
                }
            }
        },
        // sort it by our new field, highest reviews first
        {
            $sort: {
                averageRating: -1
            }
        },
        // limit to at most 10
        { $limit: 10}
	]);
};

// find reviews where the store's _id property === review's store property
storeSchema.virtual('reviews', {
	ref: 'Review', // what model to link?
	localField: '_id', // which field on the store?
	foreignField: 'store' // which field on the review?
});

function autopopulate(next) {
    this.populate('reviews');
    next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);
