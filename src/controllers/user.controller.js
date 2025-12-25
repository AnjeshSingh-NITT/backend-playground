import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from '../utils/ApiError.js';
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};

    } catch (error) {
        throw new ApiError(500, "Error in generating tokens");
    }
}

const registerUser = asyncHandler(async (req, res) => {

    // get user details from the frontend or postman - done
    // validation - done
    // check if user already exists : username/email (unique) - done
    // check for images, avatar - done
    // upload to cloudinary - done
    // create user object - create db entry - done
    // remove password and refresh token field from response - done
    // check for user creation
    // return response

    const {fullName, username, email, password} = req.body;
    console.log(`email: ${email}, Full Name: ${fullName}`);

    if(!fullName || fullName.trim() === "") throw new ApiError(400, "Full Name is required");
    if(!username || username.trim() === "") throw new ApiError(400, "Username is required");
    if(!email || email.trim() === "") throw new ApiError(400, "Email is required");
    if(!password || password.trim() === "") throw new ApiError(400, "Password is required");
    
    const existingUser = await User.findOne({
        $or: [{username},{email}]
    })

    if (existingUser) {
        console.log("Existing user:", existingUser._id);
        throw new ApiError(409, "User already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
    {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar image is required");
    }

    console.log(avatarLocalPath);
    
    
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Error uploading avatar image on cloudinary"); 
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
        email,
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "User not created");
    }

    return res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully"));

});

const loginUser = asyncHandler(async (req, res) => {
    // get email and password from req body
    // username/email based login
    // check if user exists
    // compare password
    // generate tokens (access token and refresh token)
    // send cookie
    // return response
    const {email, username, password} = req.body;

    if(!username && !email) {
        throw new ApiError(400, "Username or Email is required");
    }

    const user = await User.findOne({
     $or: [{username}, {email}]
    })

    if(!user) throw new ApiError(404, "User not found");    

    const isPassValid = await user.isPasswordCorrect(password);

    if(!isPassValid) throw new ApiError(401, "Invalid password");

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, {user: loggedInUser, accessToken, refreshToken}, "User logged in successfully")
    )

});

const logoutUser = asyncHandler(async (req, res) => {
    // get user id from req.user
    // find user in db
    // remove refresh token from db
    // clear cookies
    // return response

    await User.findByIdAndUpdate(req.user._id, 
        {
            $set: {refreshToken: undefined}
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out successfully")
    ) 

});

export { 
    registerUser, 
    loginUser,
    logoutUser
};