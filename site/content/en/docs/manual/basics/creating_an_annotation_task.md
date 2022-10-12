# CVAT

# Create Annotation Task

Click `+` > `Create new task` on the task page or project page.

![](/images/image004.jpg)

**The new task will be created under the selected organization. [About organizations](https://opencv.github.io/cvat/docs/manual/advanced/organization/).**

# Basic Configuration

## Name

Enter a name for the task.

![](/images/image005.jpg)

## Project

Specify with what project the task will be associated.

![](/images/image193.jpg)

## Label

There are two ways to work with labels: Constructor and Raw.

### Constructor

Constructor is a simple way to edit labels. To add a new label, click `Add label`.

![](/images/image123.jpg)

You can an attribute and edit it’s properties for each label.

![](/images/image125.jpg)

1. Attribute name.
2. Attribute display options:
    1. Radio. Used to choose just one option.
    2. Checkbox. Used to choose any number of options.
    3. Text. Used for a text attribute.
    4. Number. Used for a number attribute.
3. Attribute values. Values can be separated by pressing `Enter`.
4. Mutable toggle. Toggles the frame to frame changing.
5. Delete the attribute.

### Raw

Raw is an advanced way to edit labels. It presents label data in json format which allows for editing and copying labels as text.

![](/images/image126.jpg)

## Select Files

You can choose files to be used for annotation. There are four location options for selecting files:

- My computer. Used for local files on your machine.
- Connected file share. Used for network files.
- Remote sources. Used for URL input.
- Cloud Storage. About [attach cloud storage](https://opencv.github.io/cvat/docs/manual/basics/attach-cloud-storage/).

![](/images/image127.jpg)

## 3D Task Data Formats

You will need an archive with a specific structure to create a 3D task.

- Velodyne
    
    ```
    VELODYNE FORMAT
        Structure:
          velodyne_points/
            data/
              image_01.bin
              IMAGE_00 # unknown dirname,
                       # generally image_01.png can be under IMAGE_00, IMAGE_01, IMAGE_02, IMAGE_03, etc
          data/
            image_01.png
    ```
    
- 3D Pointcloud
    
    ```
    3D POINTCLOUD DATA FORMAT
    Structure:
      pointcloud/
        00001.pcd
      related_images/
        00001_pcd/
          image_01.png # or any other image
    ```
    
- 3D Option 1
    
    ```
    3D, DEFAULT DATAFORMAT Option 1
        Structure:
          data/
            image.pcd
            image.png
    ```
    
- 3D Option 2
    
    ```
    3D, DEFAULT DATAFORMAT Option 2
        Structure:
          data/
            image_1/
                image_1.pcd
                context_1.png # or any other name
                context_2.jpg
    ```
    

**You can't mix 2D and 3D data in one task.**

# Advanced Configuration

![](/images/image128.jpg)

## Sorting Method

Use it to sort the data. It’s irrelevant for videos.
For example, the sequence `2.jpeg, 10.jpeg, 1.jpeg` will be after sorting:

- `lexicographical`: 1.jpeg, 10.jpeg, 2.jpeg
- `natural`: 1.jpeg, 2.jpeg, 10.jpeg
- `predefined`: 2.jpeg, 10.jpeg, 1.jpeg

## Zip/Video Chunks

Force to use zip chunks as compressed data. Cut out content for videos only.

## Cache

This options defines how to work with the data. Check the box to use the "on-the-go data processing", which will reduce the task creation time, by preparing chunks when requests are received,
and store data in cache of limited size removing less popular items. [Mor](https://www.notion.so/docs/manual/advanced/data_on_fly/)e.

## Image Quality

Use this option to specify quality of uploaded images.
The option helps to load high resolution datasets faster.
Use the value from `5` (almost completely compressed images) to `100` (not compressed images).

## Overlap Size

Use this option to make overlapped segments. The option makes tracks seamless from one to another.

Use it for the interpolation mode.

### Interpolation Task (Video Sequence)

If you annotate a bounding box on two adjacent segments, they will be merged into one bounding box.

If overlap equals to zero or annotation is poor on adjacent segments inside a dumped annotation file, you will have several tracks: one for each segment, which corresponds to the object.

### Annotation Task (Independent Images)

If an object exists on overlapped segments, the overlap is greater than zero and the annotation is good enough on adjacent segments, it will be automatically merged into one object.

If overlap equals to zero or annotation is poor on adjacent segments inside a dumped annotation file, you will have several bounding boxes for the same object. Thus, you annotate an object on the first segment. You annotate the same object on the second segment — if you do it right — you will have one track inside the annotations.

If annotations on different segments (on overlapped frames) are very different, you will have two shapes for the same object. This functionality works only for bounding boxes.

Polygons, polylines, points don't support automatic merge on overlapped segments. Even the overlap parameter isn't zero and matches between corresponding shapes on adjacent segments is perfect.

## Segment Size

Use this option to divide a huge dataset into a few smaller segments. For example, one work cannot be annotated by several labels (it isn't supported). With Segment Size you can create several works for the same annotation task. It will help you to parallel data annotation process.

## Start Frame

The frame with which the task begins.

## Stop Frame

The frame with which the task ends.

## Frame Step

Use this option to filter video frames. For example, enter `25` to leave out every twenty fifth frame of the video, or every twenty fifth image.

## Chunk Size

Define a number of frames for a chunk when send from the client to server. Server defines automatically if empty.

**Recommended values:**

- 1080p or less: 36
- 2K or less: 8-16
- 4K or less: 4-8
- More: 1-4

## Dataset Repository

URL of the repository optionally specifies the path to the repository for storage (`default: annotation / <dump_file_name> .zip`).

The .zip and .xml file extensions are supported for annotation.

Field format: `URL [PATH]`, example: `https://github.com/project/repos.git [1/2/3/4/annotation.xml]`.

Supported URL formats :

- `https://github.com/project/repos[.git]`
- `github.com/project/repos[.git]`
- `git@github.com:project/repos[.git]`

After the task is created, the synchronization status is displayed on the task page.

If you specify a dataset repository, when you create a task, you will see a request to grant access with an ssh key. This is the key you need to [add to your github account](https://github.com/settings/keys). 

Learn about other git systems from their documentation.

## LFS

If the annotation file is large, you can create a repository with
[LFS](https://git-lfs.github.com/) support.

## Issue Tracker

You can specify full issue tracker URL.

## Source Storage

Specify source storage for import resources like annotations and backups. It can be a local or cloud storage.

If the task is created in the project, then `Use project source storage` will determine whether to use the default values or specify new ones.

## Target storage

Specify target storage for export resources like annotations and backups. It can be a local or cloud storage. 

If the task is created in the project, then `Use project target storage` will determine whether to use the default values or specify new ones.

To save and open the task, click `Submit & Open`. Also, you
can click `Submit & Continue` to create several tasks in a sequence. Then, the created tasks will be displayed on a [tasks page](https://www.notion.so/docs/manual/basics/tasks-page/).
