class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    let queryObj = { ...this.queryString };
    const excludedFields = ["page", "sort", "limit", "fields"]; // fields that are not allowed to filter
    excludedFields.forEach((el) => delete queryObj[el]);

    // advanced filtration
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(gte|gt|lte|lt|search|text)\b/g,
      (match) => `$${match}`
    );

    this.query = this.query.find(JSON.parse(queryStr)); // find inside query with queryStr in JSON filter parameters

    return this;
  }

  sorting() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      // by default, sort by creation date in descending order
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }

  limitFields() {
    // only returns some fields of the document
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }

  paginate() {
    const page = this?.queryString?.page * 1 || 1; // *1 = conversion in number; by default 1
    // const limit = this.queryString.limit * 1 || 100; // 100 document per page
    const limit = 15;
    const skip = (page - 1) * limit; // calcul du nb d'items à ignorer
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
