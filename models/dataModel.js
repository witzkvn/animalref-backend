const mongoose = require("mongoose");
const slugify = require("slugify");

const dataSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      minLength: [3, "Votre titre doit faire au moins 3 caractères."],
      maxLength: [240, "Votre titre doit faire moins de 240 caractères."],
      required: [true, "Merci de préciser un titre pour votre publication."],
    },
    slug: String,
    description: {
      type: String,
      maxLength: [
        8000,
        "La description de la publication doit faire au maximum 3000 caractères.",
      ],
      required: [
        true,
        "Merci de préciser une description pour votre publication.",
      ],
    },
    images: [String],
    rating: {
      type: Number,
      default: 0,
    },
    refTime: {
      type: Date,
    },
    category: {
      type: String,
      enum: {
        values: [
          "chasse",
          "peche",
          "environnement",
          "nutrition",
          "laboratoire",
          "traditions-loisirs",
          "biologie",
          "produits",
          "autre",
        ],
        message:
          'La catégorie de votre publication doit prendre une des valeurs suivantes : "chasse-peche", "environnement", "nutrition", "science", "traditions-loisirs", "bienetre-biologie", "autre",.',
      },
      default: "autre",
    },
    refLink: {
      type: String,
      // validate: function (link) {
      //   if (!link) return true;
      //   const regexRule = /^(http|https):\/\//;
      //   return regexRule.test(link) || "";
      // },
      // message: "Merci de fournir un lien valide pour le champs référence.",
      required: [
        true,
        "Vous devez fournir la source des informations de cette publication.",
      ],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [
        true,
        "Merci de préciser l'auteur de cette publication par son ID.",
      ],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

dataSchema.index({ title: "text", description: "text" });

dataSchema.pre("save", function (next) {
  this.slug = slugify(this.title, { lower: true });
  next();
});

const Data = mongoose.model("Data", dataSchema);

module.exports = Data;
