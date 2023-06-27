class Solution:
    def longestSubstring(self, s:str) -> int:
        char_dict = {}
        start, end = 0, 0
        max_len = 0

        # While the end pointer is less than the length of the string:
        # If the current character at end is not in char_dict, add it to char_dict with its index as the value
            # If the current character is already in char_dict, update start to the maximum of its current value 
            # and the value of the character's last seen index in char_dict + 1
            # Update the value of the current character in char_dict to the current index end
        # Else
            # Update max_len to the maximum of its current value and end - start + 1
            # Increment by one
            
        while end < len(s):
            if s[end] not in char_dict:
                char_dict[s[end]] = end
            else:
                start = max(start, char_dict[s[end]] + 1)
                char_dict[s[end]] = end

            max_len = max(max_len, end - start + 1)
            end += 1

        # Return max_len, which is the length of the longest substring without repeating characters in the input string
        return max_len



s = input("Enter string: ")
sol = Solution()
print(sol.longestSubstring(s))
