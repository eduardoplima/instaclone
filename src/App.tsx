import React, { SetStateAction } from 'react';
import './App.css';
import { Amplify, API, graphqlOperation, Storage } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';

import * as mutations from './graphql/mutations';
import * as queries from './graphql/queries';
import * as subscriptions from './graphql/subscriptions';

import awsExports from "./aws-exports";
import { ListPostsQuery } from './API';
//import { AmplifyS3Image } from '@aws-amplify/ui-react-v1';
Amplify.configure(awsExports);


function App() {
    const defaultPostState = { id: "", title: "", content: "", image: ""};
    const [postState, setPostState] = React.useState(defaultPostState);
    const [posts, setPosts] = React.useState<any | null>([]);
    const [createSectionState, setCreateSectionState] = React.useState(true);
    const [updateSectionState, setUpdateSectionState] = React.useState(false);
    const [img, setImg] = React.useState<string>("");

    const onImageChange = (e: any) => {
        if (!e.target.files[0]) return
        const file = e.target.files[0];
        const fileName = file.name;
        const contentType = fileName.split('.').pop().toLowerCase();
        console.log("fileName", fileName);
        setPostState({ ...postState, image: fileName });

        Storage.put(fileName, file, {
            contentType: `image/${contentType}`
        }).then(async (result: any) => {
            console.log("Successfully uploaded file!");
            setImg((await Storage.get(fileName)) as string);
        }).catch((err: any) => {
            console.log("Error uploading file: ", err);
        });
    }

    React.useEffect(() => {
        const fetchPosts = async (): Promise<any> => {
            try {
                const postData = await API.graphql({ query: queries.listPosts }) as { data: ListPostsQuery, erros: any[] };
                const posts = postData.data.listPosts?.items;
                setPosts(posts);
            } catch (err) { console.log('error fetching posts') }
        };

        fetchPosts();

        const createSubscription: any = API.graphql(graphqlOperation(subscriptions.onCreatePost)).subscribe({
            next: (postData: any) => {
                fetchPosts();
            }
        });

        const updateSubscription = API.graphql(graphqlOperation(subscriptions.onUpdatePost)).subscribe({
            next: (postData: any) => {
                fetchPosts();
            }
        });

        const deleteSubscription: any = API.graphql(graphqlOperation(subscriptions.onDeletePost)).subscribe({
            next: (postData: any) => {
                fetchPosts();
            }
        });

        return () => {
            createSubscription.unsubscribe();
            updateSubscription.unsubscribe();
            deleteSubscription.unsubscribe();
        }

    }, [posts]);

    const refresh = () => {
        window.location.reload();
    }

    const createPost = async (): Promise<any> => {
        try {
            if (!postState.title || !postState.content) return;
            const post = { ...postState };
            const result = await API.graphql(graphqlOperation(mutations.createPost, 
                {input: { title: post.title, 
                    content: post.content,
                    image: post.image }}));
            setPosts([...posts, post] as SetStateAction<never[]>);
            setPostState(defaultPostState);
        }
        catch (err) { console.log('error creating post:', err) }
    };

    const updatePost = async (): Promise<any> => {
        const post = { ...postState };
        try {
            if (!postState.title || !postState.content) return;
            const result = await API.graphql(graphqlOperation(mutations.updatePost, 
                {input: { id: post.id, title: post.title, content: post.content, image: post.image }}));
            console.log('result:', result);
            setUpdateSectionState(false);
            setCreateSectionState(true);
            setPostState(defaultPostState);
            refresh();
        }
        catch (err) { 
            console.log('error updating post:', err) 
            console.log(post)
        }
    };


    const deletePost = async ({ id }: { id: string }): Promise<any> => {
        try {
            if (!id) return;
            const result = await API.graphql(graphqlOperation(mutations.deletePost, {input: { id: id }}));
            console.log('result:', result);
            refresh();
        }
        catch (err) { console.log('error deleting post:', err) }
    };

    const findPosts = async (title: string): Promise<any> => {
        
        try {
            const postData: any = await API.graphql(graphqlOperation(queries.listPosts, {filter: {title: {contains: title}}}));
            const posts = postData.data.listPosts?.items;
            setPosts(posts);
        }
        catch (err) { console.log('error finding posts:', err) }
    };


    return (    
            
            <div>
      <div className="container">
        <input
          className="find"
          type="search"
          onChange={(event) => findPosts(event.target.value)}
          placeholder="Find post by title"
        />
        <Authenticator>
                {
                    ({signOut, user}) => (
                        <div className="container">
                        <h2>Amplify UI</h2>
                        <h3>Gooday, {user ? user.username : 'mate'}</h3>
                        </div>
                    )
                }
            </Authenticator>
            {
                createSectionState ? (
                    <section className="create-section">
                        <h2>Create Post</h2>
                        {
                            img && (
                                <img src={img} alt={img} />
                            )
                        }
                        <input 
                            type="file"
                            accept="image/*"
                            onChange={e => onImageChange(e)}
                        />
                        <input
                            onChange={e => setPostState({ ...postState, title: e.target.value })}
                            placeholder="Title"
                            value={postState.title}
                        />
                        <textarea
                            onChange={e => setPostState({ ...postState, content: e.target.value })}
                            placeholder="Content"
                            value={postState.content}
                        ></textarea>
                        <button className="create-button" onClick={createPost}>
                            Create
                        </button>
                    </section> 
                ) : null
            }

            {
                updateSectionState ? (
                    <section className="update-section">
                        <h2>Update Post</h2>
                        {
                            img && (
                                <img src={img} alt={img} />
                            )
                        }
                        <input 
                            type="file"
                            accept="image/*"
                            onChange={e => onImageChange(e)}
                        />
                        <input
                            onChange={e => setPostState({ ...postState, title: e.target.value })}
                            placeholder="Title"
                            value={postState.title}
                        />
                        <textarea
                            onChange={e => setPostState({ ...postState, content: e.target.value })}
                            placeholder="Content"
                            value={postState.content}
                        ></textarea>
                        <button className="update-button" onClick={updatePost}>
                            Update
                        </button>
                    </section>
                ) : null
            }

            

            {
                posts && posts.map((post: any, index: any) => (
                    <div key={post.id ? post.id : index} className="post">
                        {/*<AmplifyS3Image imgKey={post.image} />*/}
                        <label className='post-title'>{post.title}</label>
                        <p className='post-content'>{post.content}</p>
                        <button className="update-button" onClick={() => {
                            setPostState(post);
                            setUpdateSectionState(true);
                            setCreateSectionState(false);
                        }}>
                            Update
                        </button>
                        <button className="delete-button" onClick={() => deletePost(post)}>
                            Delete
                        </button>
                    </div>

                ))
            }

            
        </div>
        </div>
    );
}

export default App;
