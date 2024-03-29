"use server";

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
  } catch (error: any) {
    throw new Error(`Error creating Thread: ${error.message}`);
  }
}

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
  connectToDB();

  //calculate the number of posts to skip
  const skipAmount = (pageNumber - 1) * pageSize;

  //fetch the posts that have no parents(...top level thread)

  const postsQuery = Thread.find({ parentId: { $in: [null, undefined] } })
    .sort({ createdAt: "desc" })
    .skip(skipAmount)
    .limit(pageSize)
    .populate({ path: "author", model: User })
    .populate({
      path: "children",
      populate: {
        path: "author",
        model: User,
        select: "_id name parentId image",
      },
    });

  const totalPostsCount = await Thread.countDocuments({
    parentId: { $in: [null, undefined] },
  });

  const posts = await postsQuery.exec();

  const isNext = totalPostsCount > skipAmount + posts.length;

  return { posts, isNext };
}

export async function fetchThreadById(id: string) {
  connectToDB();

  try {
    const thread = await Thread.findById(id)
      .populate({
        path: "author",
        model: User,
        select: "_id id name image",
      }) // Populate the author field with _id and username
      .populate({
        path: "children",
        populate: [
          {
            path: "author",
            model: User,
            select: "_id id name parentId image",
          },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id name parentId image", // Select only _id and username fields of the author
            },
          },
        ],
      })
      .exec();

    return thread;
  } catch (error) {
    console.log("Error while fetching thread:", error);
    throw new Error("Unable to fetch Thread");
  }
};

export async function addCommentToThread(
  threadId: string,
  commentText: string,
  userId: string,
  path: string,
) {
  connectToDB();

  try{
    console.log("Oye idhar")
    const originalThread = await Thread.findById(threadId);
    console.log(originalThread);

    if(!originalThread){
      throw new Error("Thread not found")
    }

    const commentThread = new Thread({
      text: commentText,
      author: userId,
      parentId: threadId,
    });

    const savedCommentThread = await commentThread.save();

    // Add the comment thread's ID to the original thread's children array
    originalThread.children.push(savedCommentThread._id);

     // Save the updated original thread to the database
    await originalThread.save();

    revalidatePath(path);
  }
  catch(error){
    console.log("Error while adding comment",error);
    throw new Error("Unable to add comment");
  }
};
