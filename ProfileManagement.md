I created a new API for user profile management. Refer to `profile_management_api.json` for the OpenAPI spec.

It has always been a pain for user to maintain their memory locally on their devices. With the help of this API, it is possible to implement a feature to allow user to set up and update their profiles with a key pass to encrypt their profile.

I want the profile_data to look like below:

```
{
    "memories": [
    ]
}
```

Allow users to sync and merge their memories with its remote profile. User will need to provide the tenant_id and keypass in the configuration.

One caveat is that memories deleted by the user on the device might be resurrected, and this is not what the user wants. Find a way to track deleted memories locally so that they will also be deleted remotely when merging.