const IsEmail = (data) => {
    return /\S+@\S+\.\S+/.test(data);
};

export default IsEmail;