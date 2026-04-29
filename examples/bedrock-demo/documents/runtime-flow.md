# Governix Runtime Flow

The integrating application follows this flow:

1. call Governix runtime policy evaluate before a Bedrock request
2. enforce the returned action such as allow, deny, force_filter, downgrade_model, or quota_block
3. call Bedrock directly
4. emit a Governix runtime event after the request finishes

Governix stores summaries and metadata only. It does not store full prompts or full responses in the MVP.
