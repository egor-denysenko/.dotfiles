import re
with open('dot_config/scripts/executable_betterGitBranch.sh', 'r') as f:
    content = f.read()

content = content.replace('<<<<<<< HEAD\n\t    printf "${GREEN}%-${width1}s ${RED}%-${width2}s ${BLUE}%-${width3}s ${YELLOW}%-${width4}s ${NO_COLOR}%-${width5}s\\n" "$ahead" "$behind" "$branch" "$time" "$description"\n=======\n\t    printf "$row_format" "$ahead" "$behind" "$branch" "$time" "$description"\n>>>>>>> origin/chezmoi\n', '\t    printf "$row_format" "$ahead" "$behind" "$branch" "$time" "$description"\n')

with open('dot_config/scripts/executable_betterGitBranch.sh', 'w') as f:
    f.write(content)
