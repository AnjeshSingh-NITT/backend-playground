import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from '../utils/ApiError.js';
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar image is required");
    }
    
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Error uploading avatar image"); 
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

export { registerUser };