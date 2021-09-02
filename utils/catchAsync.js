// automatic error catch for async functions
module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(err => next(err))
  }
}