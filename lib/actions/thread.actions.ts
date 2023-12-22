"use server"

import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";

interface Params {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

export async function createThread({
  text,
  author,
  communityId,
  path,
}: Params) {
  try {
    connectToDB();

    const createThread = await Thread.create({
      text,
      author,
      community: null,
    });

    await User.findByIdAndUpdate(author, {
      $push: { threads: createThread._id },
    });

    revalidatePath(path);
  } 
  catch (error: any) {
    throw new Error(`Error creating Thread: ${error.message}`)
  }
}

export async function fetchPosts(pageNumber = 1,pageSize = 20){
    connectToDB();

    //calculate the number of posts to skip
    const skipAmount = (pageNumber-1)*pageSize;

    //fetch the posts that have no parents(...top level thread)

    const postsQuery = Thread.find({ parentId: { $in: [null,undefined]}})
        .sort({ createdAt:'desc' })
        .skip(skipAmount)
        .limit(pageSize)
        .populate({ path:'author',model:User })
        .populate({
            path:'children',
            populate:{
                path:'author',
                model:User,
                select:"_id name parentId image"
            }
        })

        const totalPostsCount = await Thread.countDocuments({ parentId: { $in:[null,undefined]}});

        const posts = await postsQuery.exec();

        const isNext = totalPostsCount > skipAmount + posts.length;

        return { posts,isNext };
}
