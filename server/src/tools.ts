export function parseDate(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value.substr == "function") {
    return new Date(
      Date.UTC(
        value.substr(0, 4),
        value.substr(5, 2) - 1,
        value.substr(8, 2),
        value.substr(11, 2),
        value.substr(14, 2),
        value.substr(17, 2)
      )
    );
  }

  if (typeof value.getTime == "function") {
    return value;
  }

  console.log(value);
  throw new Error("date value is invalid data type");
}
