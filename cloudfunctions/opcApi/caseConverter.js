function snakeToCamelKey(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function snakeToCamel(value) {
  if (Array.isArray(value)) return value.map(snakeToCamel);
  if (!value || typeof value !== "object") return value;

  return Object.keys(value).reduce((result, key) => {
    if (["__proto__", "prototype", "constructor"].includes(key)) return result;
    result[snakeToCamelKey(key)] = snakeToCamel(value[key]);
    return result;
  }, {});
}

module.exports = {
  snakeToCamel,
};
