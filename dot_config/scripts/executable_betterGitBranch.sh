#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NO_COLOR='\033[0m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NO_COLOR='\033[0m'

width1=5
width2=6
width3=30
width4=20
width5=40

# Main script
main_branch=$(git rev-parse HEAD)

printf "${GREEN}%-${width1}s ${RED}%-${width2}s ${BLUE}%-${width3}s ${YELLOW}%-${width4}s ${NO_COLOR}%-${width5}s\n" "Ahead" "Behind" "Branch" "Last Commit"  " "

# Separator line for clarity
printf "${GREEN}%-${width1}s ${RED}%-${width2}s ${BLUE}%-${width3}s ${YELLOW}%-${width4}s ${NO_COLOR}%-${width5}s\n" "-----" "------" "------------------------------" "-------------------" " "


format_string="%(refname:short)@%(committerdate:relative)@%(ahead-behind:HEAD)"
IFS=$'\n'

# Parse all descriptions into a bash associative array to avoid N+1 git queries
declare -A desc_map
while IFS=' ' read -r key val; do
    branch_name="${key#branch.}"
    branch_name="${branch_name%.description}"
    desc_map["$branch_name"]="$val"
done < <(git config --get-regexp '^branch\..*\.description$' 2>/dev/null || true)

for branchdata in $(git for-each-ref --sort=-authordate --format="$format_string" refs/heads/ --no-merged); do
    IFS='@' read -r branch time ahead_behind <<< "$branchdata"
    if [ "$branch" != "$main_branch" ]; then
            # Get branch description
            description="${desc_map[$branch]}"
            
            # Extract ahead and behind from the output of %(ahead-behind:HEAD)
            IFS=' ' read -r ahead behind <<< "$ahead_behind"
            
            # Display branch info
	    printf "${GREEN}%-${width1}s ${RED}%-${width2}s ${BLUE}%-${width3}s ${YELLOW}%-${width4}s ${NO_COLOR}%-${width5}s\n" "$ahead" "$behind" "$branch" "$time" "$description"
    fi
done


