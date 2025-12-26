import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from '../utils/ApiError.js';
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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

    // console.log(avatarLocalPath);
    
    
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

const refreshAccessToken = asyncHandler(async (req, res) => {
    // get token from cookies
    const incomingRefreshRoken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshRoken) {
        throw new ApiError(401, "Refresh token not found");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshRoken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user) throw new ApiError(404, "User not found");
    
        if(user.refreshToken !== incomingRefreshRoken) {
            throw new ApiError(401, "Invalid refresh token - expired or mismatched");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
       const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id);
    
       return res
       .status(200)
       .cookie("accessToken", accessToken, options)
       .cookie("refreshToken", newRefreshToken, options)
       .json(
           new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access token refreshed successfully")
       )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect) throw new ApiError(400, "invalid old password")

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(new ApiResponse(200,null,"Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req,res) => {
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully");
});

const updateAccount = asyncHandler(async (req,res) => {
    const {fullName, email} = req.body;
    if(!fullName || !email)
    {
        throw new ApiError(400, "Both full name and email are required");
    }

    const user = User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                fullName,
                email
            }
        },{new: true}
    ).select("-password");

    return res.status(200).json(new ApiResponse(200,user,"Account details updated successfully"));

});

const updateUserAvatar = asyncHandler(async (req,res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath)
    {
        throw new ApiError(400,"Avatar file is missing");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(500, "Error uploading avatar image on cloudinary"); 
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },{new: true}
    ).select("-password");

    return res.status(200).json(new ApiResponse(200,user,"Account Avatar updated successfully"));
});

const updateUserCover = asyncHandler(async (req,res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath)
    {
        throw new ApiError(400,"cover image file is missing");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage.url){
        throw new ApiError(500, "Error uploading cover image on cloudinary"); 
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                cover: cover.url
            }
        },{new: true}
    ).select("-password");

    return res.status(200).json(new ApiResponse(200,user,"Account Cover Image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req,res) => {
    const {username} = req.params;
    if(!username?.trim())
    {
        throw new ApiError(400, "username is missing");
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])
    if(!channel?.length){
        throw new ApiError(404,"channel does not exist");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,channel[0],"User channel fetched successfully"));
});

const getWatchHistory = asyncHandler(async (req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreingField: "_id",
                        as: "owner",
                        pipeline: [
                            {
                                $project: {
                                    fullName: 1,
                                    userName: 1,
                                    avatar: 1
                                }
                            }
                        ]
                    }
                },
                {
                    $addFields:
                    {
                        owner: {
                            $first: "$owner"
                        }
                    }
                }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(ApiResponse(200,user[0].watchHistory,"watch history fetched successfully"));
});

export { 
    registerUser, 
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccount,
    updateUserAvatar,
    updateUserCover,
    getUserChannelProfile,
    getWatchHistory
};