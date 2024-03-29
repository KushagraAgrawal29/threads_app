"use server";

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";
import Thread from "../models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";

interface Params{
    userId: string;
    username:string,
    name:string,
    bio:string,
    image:string,
    path:string
}

export async function updateUser({
    userId,
    username,
    name,
    bio,
    image,
    path,
}:Params): Promise<void> {
  connectToDB();

  try {
    await User.findOneAndUpdate(
      { id: userId },
      {
        username: username.toLowerCase(),
        name,
        bio,
        image,
        onboarded: true,
      },
      { upsert: true }
    );

    if (path === "/profile/edit") {
      revalidatePath(path);
    }
  } 
  catch (error) {
    console.log(`Error in updating/creating the user : ${error}`);
  }
}

export async function fetchUser(userId:string) {
    try {
        connectToDB()

        return await User
            .findOne({ id:userId })
            // .populate({
            //     path:'communities',
            //     model:Community
            // })
    } 
    catch (error:any) {
        throw new Error(`Failed to fetch User: ${error.message}`)
    }
}

export async function fetchUserPosts(userId: string) {
  try{
    connectToDB();

    //find all the threads authored by user with the given userId
    const threads = await User.findOne({
      id: userId
    }).populate({
      path: "threads",
      model: Thread,
      populate: {
        path: 'children',
        model: Thread,
        populate: {
          path: 'author',
          model: User,
          select: 'name image id',
        }
      }
    });

    return threads;
  }
  catch(error: any){
    console.log("Error fetching user threads",error);
    throw error;
  }
};

export async function fetchUsers({
  userId,
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
}: {
  userId: string,
  searchString?: string,
  pageNumber?: number,
  pageSize?: number,
  sortBy?: SortOrder
}) {
  try{
    connectToDB();

    // Calculate the number of users to skip based on the page number and page size.
    const skipAmount = (pageNumber - 1) * pageSize;

    // Create a case-insensitive regular expression for the provided search string.
    const regex = new RegExp(searchString, "i");

    //create an initial query object to filter users
    const query: FilterQuery<typeof User> = {
      id: {$ne : userId},  // Exclude the current user from the results.
    }

    //if serach string is not empty, add the $or operator to match either username or name fields
    if(searchString.trim() !== " "){
      query.$or = [
        { username: { $regex: regex } },
        { name: { $regex: regex } }, 
      ]
    }

    // Define the sort options for the fetched users based on createdAt field and provided sort order.
    const sortOptions = { createdAt: sortBy };

    const userQuery = User.find(query)
      .sort(sortOptions)
      .skip(skipAmount)
      .limit(pageSize);

      // Count the total number of users that match the search criteria (without pagination).
      const totalUserCount = await User.countDocuments(query);

      const users = await userQuery.exec();

      //check if there are more users beyond the current page
      const isNext = totalUserCount > skipAmount + users.length;

      return { users,isNext };
  }
  catch(error){
    console.log("Error fetching users",error);
    throw new Error;
  }
};

export async function getActivity(userId: string) {
  try{
    connectToDB();

    //find all threads created by user
    const userThreads = await Thread.find({ authot: userId });

    // Collect all the child thread ids (replies) from the 'children' field of each user thread
    const childThreadIds = userThreads.reduce((acc,userThread) => {
      return acc.concat(userThread.children)
    },[]);

    // Find and return the child threads (replies) excluding the ones created by the same user
    const replies = await Thread.find({
      _id: { $in: childThreadIds },
      author: { $ne: userId }, // Exclude threads authored by the same user
    }).populate({
      path: "author",
      model: User,
      select: "name image _id",
    });

    return replies;
  }
  catch(error: any){
    console.log(`Failed to fetch user activity: ${error.message}`);
    throw error;
    // throw new Error;
  }
}
