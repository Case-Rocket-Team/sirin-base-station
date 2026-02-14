#!/bin/bash

echo "Starting mock sirin server on port 9002"
echo "Type messages and press Enter to send them"
websocat -s 127.0.0.1:9002
