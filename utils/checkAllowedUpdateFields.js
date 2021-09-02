const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  if (allowedFields.includes('settings') && obj.settings) {
    const newSettingsObj = filterSubObjectFields(obj.settings, "theme", "mainColor")
    if (newSettingsObj) newObj.settings = newSettingsObj;
  }

  Object.keys(obj).forEach(el => {
    if (el !== "settings" && allowedFields.includes(el)) newObj[el] = obj[el]
  })
  return newObj;
}

const filterSubObjectFields = (subObj, ...allowedSubFields) => {
  if (typeof subObj === "object") {
    const newSubObj = {}

    Object.keys(subObj).forEach((key) => {
      if (allowedSubFields.includes(key)) newSubObj[key] = subObj[key]
    })
    return newSubObj;
  } else return
}

module.exports = filterObj;