const ObjectGetKeyByValue = (object, value) => {
    return Object.keys(object).find(key => object[key] === value);
};

export default ObjectGetKeyByValue;